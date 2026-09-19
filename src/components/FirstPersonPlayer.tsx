import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, MathUtils } from 'three'
import { useDragLook } from '../systems/useDragLook'
import { useMoveInput } from '../systems/useMoveInput'
import { areaAt, floorHeight, resolveWalk, type WalkFrame, type WalkVolume } from '../systems/walk'

/** Standing eye height above whatever the player's feet are on, in metres. */
export const EYE_HEIGHT = 1.65

/** Body radius used for collision. Keeps the player a shoulder off any edge. */
const PLAYER_RADIUS = 0.34

/** Metres per second, walking and with shift held (PLAN.md §12). */
const WALK_SPEED = 2.3
const SPRINT_SPEED = 4.4

/** Exponential rate at which speed reaches the intended speed. */
const ACCELERATION = 13

/** Exponential rate at which the eye settles onto a new floor height. */
const FLOOR_SMOOTHING = 9

/**
 * Head bob. Very subtle on purpose: the goal is realism, not arcade feedback
 * (PLAN.md §22, §28).
 */
const STEPS_PER_METRE = 0.95
const BOB_RISE = 0.028
const BOB_SWAY = 0.016

/**
 * What riding a train feels like (PLAN.md §22). Deliberately tiny: the body
 * leans a few centimetres against the train's acceleration and the floor
 * trembles under it, and that is all. Anything you can consciously see is too
 * much — the goal is realism, not arcade feedback.
 */
const LEAN_PER_ACCELERATION = 0.045
const LEAN_LIMIT = 0.09
const LEAN_SMOOTHING = 5
const TREMBLE_RISE = 0.0035
const TREMBLE_SWAY = 0.005
/** Speed at which the tremble is at full strength, in m/s. */
const TREMBLE_FULL_SPEED = 14

export interface PlayerSpawn {
  x: number
  z: number
  /** Heading in radians, measured the same way as camera yaw. */
  yaw: number
  pitch?: number
}

interface FirstPersonPlayerProps {
  /** The floor the player is allowed to walk on. */
  volume: WalkVolume
  spawn: PlayerSpawn
  eyeHeight?: number
}

/** Scratch orientation, reused every frame so the loop allocates nothing. */
const orientation = new Euler(0, 0, 0, 'YXZ')

/**
 * The player: a pair of eyes at eye height that can look around and walk.
 *
 * There is no avatar, by design — the camera is the player (PLAN.md §3). It
 * owns the camera outright: drag to look, WASD or the arrows to walk, shift to
 * run, with the walk clamped to the walkable floor so the player cannot step
 * off a platform or through a train.
 *
 * Some of that floor moves. Walking through an open doorway puts the player
 * on a carriage's floor, and from then on they are carried by it: each frame
 * they are moved by however far their frame moved, before their own step is
 * worked out. Boarding and alighting need no mode of their own — they are
 * what happens when a step lands on rectangles belonging to a different frame
 * (PLAN.md §5).
 */
export function FirstPersonPlayer({
  volume,
  spawn,
  eyeHeight = EYE_HEIGHT,
}: FirstPersonPlayerProps) {
  const camera = useThree((state) => state.camera)

  const look = useDragLook({ yaw: spawn.yaw, pitch: spawn.pitch ?? 0 })
  const move = useMoveInput()

  const position = useRef({ x: spawn.x, z: spawn.z })
  const velocity = useRef({ x: 0, z: 0 })
  const spawnFloor = areaAt(volume, spawn.x, spawn.z, PLAYER_RADIUS)
  const floorY = useRef(spawnFloor ? floorHeight(spawnFloor) : 0)

  /** Distance walked, in steps, driving the bob. */
  const stride = useRef(0)

  /** The moving floor the player is standing on, and where it was last frame. */
  const riding = useRef<WalkFrame | null>(null)
  const rodeFrom = useRef({ x: 0, z: 0 })

  /** Eased lean against the train's acceleration, in metres. */
  const lean = useRef(0)

  useFrame((state, delta) => {
    if (delta <= 0) return
    // A tab restored after a long pause reports a huge delta; a step that big
    // would tunnel the player straight through a wall.
    const step = Math.min(delta, 0.1)

    const { yaw, pitch } = look.current
    const { forward, strafe, sprint } = move.current

    // Camera-relative heading: forward is where the player is looking,
    // flattened onto the floor, and right is a quarter turn clockwise of it.
    const sinYaw = Math.sin(yaw)
    const cosYaw = Math.cos(yaw)

    let dirX = -sinYaw * forward + cosYaw * strafe
    let dirZ = -cosYaw * forward - sinYaw * strafe

    // Normalise so walking a diagonal is not faster than walking a straight line.
    const length = Math.hypot(dirX, dirZ)
    if (length > 0) {
      dirX /= length
      dirZ /= length
    }

    const speed = sprint ? SPRINT_SPEED : WALK_SPEED
    const ease = 1 - Math.exp(-ACCELERATION * step)
    velocity.current.x = MathUtils.lerp(velocity.current.x, dirX * speed, ease)
    velocity.current.z = MathUtils.lerp(velocity.current.z, dirZ * speed, ease)

    const from = position.current

    // Carried first, stepped second: the player is taken along by whatever
    // they are standing on, and then walks about on top of that. The frame's
    // own position is written by the train earlier in this same frame, so the
    // two never disagree about where the saloon is.
    const carrier = riding.current
    if (carrier) {
      from.x += carrier.x - rodeFrom.current.x
      from.z += carrier.z - rodeFrom.current.z
      rodeFrom.current.x = carrier.x
      rodeFrom.current.z = carrier.z
    }

    const walked = resolveWalk(
      volume,
      from.x,
      from.z,
      from.x + velocity.current.x * step,
      from.z + velocity.current.z * step,
      PLAYER_RADIUS,
    )

    // Take the velocity back from the distance actually covered, so a blocked
    // axis stops dead instead of building up a shove against the wall.
    velocity.current.x = (walked.x - from.x) / step
    velocity.current.z = (walked.z - from.z) / step
    from.x = walked.x
    from.z = walked.z

    if (walked.area) {
      floorY.current = MathUtils.lerp(
        floorY.current,
        floorHeight(walked.area),
        1 - Math.exp(-FLOOR_SMOOTHING * step),
      )
    }

    // Stepping on to a different floor is boarding or alighting. The old
    // frame is told it is no longer carrying anybody, which is how a train
    // learns it has the player aboard.
    //
    // Only a step that lands somewhere definite counts. A step that lands
    // nowhere at all — a doorway switched off underfoot, a rescue that found
    // no floor this frame — leaves the player attached to whatever was
    // already carrying them, because the alternative is being quietly put
    // down in mid-air while their train drives out from under them.
    if (walked.area) {
      const frame = walked.area.frame ?? null
      if (frame !== riding.current) {
        if (riding.current) riding.current.carrying = false
        if (frame) {
          frame.carrying = true
          rodeFrom.current.x = frame.x
          rodeFrom.current.z = frame.z
        }
        riding.current = frame
      }
    }

    const frame = riding.current

    // Bob rides on how fast the player is actually moving, so it fades in and
    // out with the walk rather than switching on and off.
    const pace = Math.hypot(velocity.current.x, velocity.current.z)
    stride.current += pace * step * STEPS_PER_METRE * Math.PI * 2
    const weight = Math.min(pace / WALK_SPEED, 1)
    const rise = Math.sin(stride.current * 2) * BOB_RISE * weight
    const sway = Math.sin(stride.current) * BOB_SWAY * weight

    // Riding: lean back as the train pulls away and forward as it brakes, and
    // pick up the tremble of the track through the floor.
    const target = frame
      ? MathUtils.clamp(-frame.acceleration * LEAN_PER_ACCELERATION, -LEAN_LIMIT, LEAN_LIMIT)
      : 0
    lean.current = MathUtils.lerp(lean.current, target, 1 - Math.exp(-LEAN_SMOOTHING * step))

    const shaking = frame ? Math.min(Math.abs(frame.velocity) / TREMBLE_FULL_SPEED, 1) : 0
    const time = state.clock.elapsedTime
    const trembleY = Math.sin(time * 43.1) * TREMBLE_RISE * shaking
    const trembleZ = Math.sin(time * 27.7) * TREMBLE_SWAY * shaking

    camera.position.set(
      from.x + cosYaw * sway + lean.current,
      floorY.current + eyeHeight + rise + trembleY,
      from.z - sinYaw * sway + trembleZ,
    )

    // Yaw about world up, then pitch about the camera's own right, no roll.
    orientation.set(pitch, yaw, 0)
    camera.quaternion.setFromEuler(orientation)

    // TEMPORARY DIAGNOSTIC — remove.
    ;(window as unknown as Record<string, unknown>).__player = {
      x: from.x,
      z: from.z,
      floorY: floorY.current,
      area: walked.area?.id ?? null,
      riding: riding.current ? { x: riding.current.x, z: riding.current.z } : null,
    }
  })

  return null
}

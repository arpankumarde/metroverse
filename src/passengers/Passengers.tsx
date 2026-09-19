import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Group, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import type { CorridorConfig, RollingStockConfig } from '../data/types'
import type { Road } from '../train/roads'
import { VIEW_DISTANCE } from '../world/atmosphere'
import { PART_COUNT, PART_SIZE, partColor, poseBody } from './body'
import { createCrowd, stepCrowd, type Passenger } from './crowd'

/**
 * The people on the line, drawn (PLAN.md §18, §28).
 *
 * How many bodies can be on screen is a fixed budget rather than however many
 * the simulation happens to have made: the crowd is nine InstancedMeshes of
 * this many instances, and every frame the nearest people are packed into
 * them. Everyone past the haze is simply not drawn, and everyone inside it
 * competes for the slots — near first, so a platform full of people can never
 * be crowded out of the draw by a trainload half a kilometre away.
 *
 * The simulation itself runs for the whole line whether or not anyone is
 * looking, because it has to: a train has to arrive at Mandi House already
 * carrying the people who got on at Rajiv Chowk, and that only works if the
 * part of the line behind you kept running while you were not watching.
 */

/** How many people can be drawn at once. */
const CAPACITY = 340

/** Inside this, everybody is drawn before anyone further out gets a slot. */
const NEAR_RANGE = 90

/** A step this long means the tab was in the background; don't lurch. */
const MAX_STEP = 0.1

const AXIS_Y = new Vector3(0, 1, 0)
const AXIS_Z = new Vector3(0, 0, 1)

/** Scratch, reused every frame so drawing a crowd allocates nothing. */
const body = Array.from({ length: PART_COUNT }, () => new Object3D())
const person = new Object3D()
const spin = new Quaternion()
const world = new Matrix4()
const tint = new Color()

interface PassengersProps {
  corridor: CorridorConfig
  /** The service the crowd rides: the same roads and trains everything reads. */
  roads: ReadonlyMap<string, Road>
  stock: RollingStockConfig
}

export function Passengers({ corridor, roads, stock }: PassengersProps) {
  const crowd = useMemo(() => createCrowd(corridor, roads, stock), [corridor, roads, stock])

  /**
   * The nine part meshes are read off the group they are drawn in rather than
   * collected into refs of their own: they are the group's only children, in
   * the order of `Part`, so the group is already the list.
   */
  const group = useRef<Group>(null)

  /** Who is in each instance slot, so clothes are only rewritten on a change. */
  const held = useRef(new Int32Array(CAPACITY).fill(-1))
  const heldSerial = useRef(new Int32Array(CAPACITY))

  // The meshes are built full and would otherwise draw a heap of unposed
  // bodies at the world origin until the first frame packs them.
  useLayoutEffect(() => {
    for (const mesh of group.current?.children ?? []) {
      if (mesh instanceof InstancedMesh) mesh.count = 0
    }
  }, [])

  useFrame((state, delta) => {
    const step = Math.min(delta, MAX_STEP)
    if (step > 0) stepCrowd(crowd, step)

    const parts = group.current?.children
    if (!parts) return

    const camera = state.camera.position
    const time = state.clock.elapsedTime
    const people = crowd.people
    const slots = held.current
    const serials = heldSerial.current

    let used = 0
    let recoloured = false

    /** Draw everybody whose distance falls in a band, until the slots run out. */
    const pack = (from: number, to: number): void => {
      const near = from * from
      const far = to * to

      for (let index = 0; index < people.length && used < CAPACITY; index++) {
        const passenger = people[index]
        if (!passenger || !passenger.active) continue

        const frame = passenger.frame
        const x = frame ? frame.x + passenger.x : passenger.x
        const z = frame ? frame.z + passenger.z : passenger.z

        const dx = x - camera.x
        const dz = z - camera.z
        const distance = dx * dx + dz * dz
        if (distance < near || distance >= far) continue

        const y = (frame ? frame.y + passenger.floorY : passenger.floorY) + passenger.lift
        const slot = used++

        place(parts, passenger, x, y, z, slot, time)

        if (slots[slot] !== index || serials[slot] !== passenger.serial) {
          slots[slot] = index
          serials[slot] = passenger.serial
          paint(parts, passenger, slot)
          recoloured = true
        }
      }
    }

    pack(0, NEAR_RANGE)
    pack(NEAR_RANGE, VIEW_DISTANCE)

    commit(parts, used, recoloured)
  })

  return (
    <group ref={group} name="crowd">
      {PART_SIZE.map((size, index) => (
        <instancedMesh
          key={index}
          args={[undefined, undefined, CAPACITY]}
          castShadow
          receiveShadow
          // The contents change every frame and are already distance-culled;
          // a bounding sphere recomputed per frame would cost more than it saves.
          frustumCulled={false}
        >
          <boxGeometry args={[size[0], size[1], size[2]]} />
          <meshStandardMaterial roughness={0.78} metalness={0} />
        </instancedMesh>
      ))}
    </group>
  )
}

/** Hand the frame's worth of instances over to the GPU. */
function commit(parts: readonly Object3D[], used: number, recoloured: boolean): void {
  for (const mesh of parts) {
    if (!(mesh instanceof InstancedMesh)) continue

    mesh.count = used
    mesh.instanceMatrix.needsUpdate = true
    if (recoloured && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
}

/**
 * Write one person's nine parts into their instance slot.
 *
 * The body is posed once in its own space — feet at the origin, facing +Z —
 * and then carried into the world by a single transform per person, so the
 * pose never has to know where anybody is. The lean goes on the outside of
 * the yaw because a train pulls a standing body about the world's axis, not
 * about whichever way that body happens to be facing.
 */
function place(
  parts: readonly Object3D[],
  passenger: Passenger,
  x: number,
  y: number,
  z: number,
  slot: number,
  time: number,
): void {
  poseBody(body, {
    stride: passenger.stride,
    pace: passenger.pace,
    seated: passenger.seated,
    seatY: passenger.seatY / passenger.scale,
    time: time + passenger.phase,
  })

  person.position.set(x, y, z)
  person.quaternion
    .setFromAxisAngle(AXIS_Z, passenger.lean)
    .multiply(spin.setFromAxisAngle(AXIS_Y, passenger.yaw))
  person.scale.setScalar(passenger.scale)
  person.updateMatrix()

  for (let part = 0; part < PART_COUNT; part++) {
    const mesh = parts[part]
    const local = body[part]
    if (!(mesh instanceof InstancedMesh) || !local) continue

    local.updateMatrix()
    world.multiplyMatrices(person.matrix, local.matrix)
    mesh.setMatrixAt(slot, world)
  }
}

/** Dress the person now in a slot. Only run when the slot changes hands. */
function paint(
  parts: readonly Object3D[],
  passenger: Passenger,
  slot: number,
): void {
  for (let part = 0; part < PART_COUNT; part++) {
    const mesh = parts[part]
    if (!(mesh instanceof InstancedMesh)) continue

    tint.setHex(partColor(passenger.colors, part))
    mesh.setColorAt(slot, tint)
  }
}

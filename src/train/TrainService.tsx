import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group } from 'three'
import type { MetroLine, RollingStockConfig } from '../data/types'
import { VIEW_DISTANCE } from '../world/atmosphere'
import { driveCarriage, reportCarriage, setCarriageDoors } from './carriage'
import { trainLength } from './geometry'
import { worldPitch, worldX, worldY } from './line'
import { useRoad } from './roads'
import { TrainState } from './service'
import { Train } from './Train'

interface TrainServiceProps {
  stock: RollingStockConfig
  line: MetroLine
  /** The road this train works. Its service must be running on the clock. */
  trackId: string
  /** Which of that road's fleet this is. */
  slot: number
}

/**
 * How close the player has to be for a train's saloon to be built at all.
 *
 * Every train on the line has an interior, but only the handful you could
 * actually see into is worth the draw calls — a furnished saloon is about as
 * expensive again as the car it is inside. The range is well beyond the
 * platform, so a train is always fully fitted out long before the player
 * could board it, and the hysteresis stops one hovering at the threshold from
 * being built and torn down every few frames (PLAN.md §28).
 */
const SALOON_RANGE = 260
const SALOON_HYSTERESIS = 40

/**
 * One train of the line, put where the simulation says it is (PLAN.md §7, §8).
 *
 * The simulation is `service.ts`, stepped by the `ServiceClock` above this
 * component, and it does not know this component exists. All that happens
 * here is reading the runtime each frame and pushing it into the scene graph.
 * Nothing per-frame goes through React state, so a train costs no re-renders
 * while it runs (PLAN.md §28).
 *
 * Reading rather than owning the runtime is what lets the destination board
 * and the platform announcements describe this exact train (PLAN.md §16).
 *
 * The inner group is turned to face the direction of travel, so the train
 * itself is always drawn working along its own +X. That also flips the car's
 * sides, which is why the platform side is converted into a side of the train
 * here. The outer group carries the grade, in world axes, so a train on a
 * ramp is pitched correctly whichever way it is facing (PLAN.md §6).
 *
 * The one thing that flows back out is whether the player is aboard. They
 * board by walking in, so nothing tells this component about it; it reads the
 * carriage they are standing on and passes that to the runtime, which is what
 * keeps a train with somebody in it from being recycled or from running off
 * the end of the built line with them (PLAN.md §5).
 */
export function TrainService({ stock, line, trackId, slot }: TrainServiceProps) {
  const road = useRoad(trackId)
  const camera = useThree((state) => state.camera)

  const group = useRef<Group>(null)
  const doorOpen = useRef(0)
  const travelled = useRef(0)

  /** Whether this train's saloon is currently built. */
  const [furnished, setFurnished] = useState(false)
  const built = useRef(false)

  const schedule = road?.schedule
  const direction = schedule?.direction ?? 1

  /** Turning the train around swaps its sides along with everything else. */
  const doorSide: 1 | -1 = schedule?.platformSide === direction ? 1 : -1

  const overhang = trainLength(stock) / 2

  useFrame((_, delta) => {
    const scene = group.current
    if (!scene) return

    const runtime = road?.trains[slot]
    const carriage = road?.carriages[slot]

    // No service on this road means no train on it, rather than one parked at
    // a stopping mark with its doors shut.
    if (!road || !runtime || !carriage) {
      scene.visible = false
      return
    }

    const x = worldX(road.schedule, runtime.travel)
    const y = worldY(road.schedule, runtime.travel)

    // Pitch is applied in world axes on the outer group, and the inner group
    // is what turns the train around, so one expression covers a train
    // working either way down the same ramp.
    scene.position.set(x, y, road.schedule.offsetZ)
    scene.rotation.z = worldPitch(road.schedule, runtime.travel)
    doorOpen.current = runtime.doors
    travelled.current = runtime.travel

    driveCarriage(carriage, x, y, road.schedule.offsetZ, delta)
    setCarriageDoors(carriage, runtime.doors)

    // Standing by means standing off the end of the line with the rest of the
    // pool, which is nowhere; a train the player is riding is never that.
    const standingBy = runtime.state === TrainState.IDLE && !carriage.carrying
    const distance = Math.abs(camera.position.x - x)

    scene.visible = !standingBy && distance < VIEW_DISTANCE + overhang

    // Boarding is the player walking in, so this is the only place the
    // simulation finds out about it. A train nobody can reach is also not
    // floor — without that, the whole standby pool, parked on one spot off
    // the end of the line, would be walkable.
    reportCarriage(runtime, carriage, scene.visible)

    const range = built.current ? SALOON_RANGE + SALOON_HYSTERESIS : SALOON_RANGE
    const furnish = scene.visible && distance < range
    if (furnish !== built.current) {
      built.current = furnish
      setFurnished(furnish)
    }
  })

  return (
    // Hidden until the first frame has placed it, so it cannot flash up at
    // the start of the line before the simulation has run at all.
    <group ref={group} visible={false}>
      <group rotation={[0, direction === 1 ? 0 : Math.PI, 0]}>
        <Train
          stock={stock}
          line={line}
          doorSide={doorSide}
          doorOpen={doorOpen}
          travelled={travelled}
          saloon={furnished}
        />
      </group>
    </group>
  )
}

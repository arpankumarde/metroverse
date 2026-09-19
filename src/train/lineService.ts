import type { CorridorConfig, RollingStockConfig, ServiceConfig } from '../data/types'
import { PLATFORM_EDGE_OFFSET } from '../stations/geometry'
import { mergeVolumes, type WalkVolume } from '../systems/walk'
import { createCarriage } from './carriage'
import { roadSchedule, worldX, worldY } from './line'
import { workingSeconds } from './predict'
import type { Road } from './roads'
import { TrainState, createTrainRuntime, launchTrain, stepTrain } from './service'

/**
 * The service on a line: every road, every train working it, and the clock
 * they all run on (PLAN.md §7, §16).
 *
 * It is built outside React and stepped from inside it, because more than the
 * renderer needs it: the floor the player walks on includes the floor of every
 * train, and that has to exist before anything is drawn.
 */

/** Step used to run the service up before the player sees it, in seconds. */
const WARM_UP_STEP = 0.2

/** How far apart the roads are worked, as a fraction of the headway. */
const ROAD_STAGGER = 0.5

function createRoad(
  corridor: CorridorConfig,
  service: ServiceConfig,
  stock: RollingStockConfig,
  trackIndex: number,
): Road {
  const track = corridor.tracks[trackIndex]
  if (!track) throw new Error(`Corridor ${corridor.id} has no road ${trackIndex}`)

  const schedule = roadSchedule(corridor, track)

  // Enough trains that the next one is always ready to leave on time, with one
  // in hand: a road that ran out of trains would stretch its own headway.
  const fleet = Math.ceil(workingSeconds(service, schedule) / service.headway) + 1
  const stagger = trackIndex * ROAD_STAGGER * service.headway

  return {
    schedule,
    service,
    trains: Array.from({ length: fleet }, createTrainRuntime),
    carriages: Array.from({ length: fleet }, () => {
      const carriage = createCarriage({
        stock,
        platformSide: schedule.platformSide,
        platformEdgeOffset: PLATFORM_EDGE_OFFSET,
      })

      // A carriage is a floor, and a floor left at the world origin would be
      // a saloon lying across Rajiv Chowk's platform until the first frame
      // moved it. Stand them where their trains stand: out beyond the end of
      // the line, waiting to be sent out.
      carriage.x = worldX(schedule, 0)
      carriage.y = worldY(schedule, 0)
      carriage.z = schedule.offsetZ
      return carriage
    }),
    dueAway: Array.from({ length: fleet }, (_, slot) => stagger + slot * service.headway),
    now: 0,
  }
}

/** Advance one road by `delta` seconds, sending out any train now due away. */
export function stepRoad(road: Road, delta: number): void {
  road.now += delta

  road.trains.forEach((runtime, slot) => {
    const due = road.dueAway[slot] ?? Number.POSITIVE_INFINITY

    // A train with the player aboard is never sent out again from the other
    // end of the line: that would be a teleport, and they are standing in it.
    if (runtime.state === TrainState.IDLE && road.now >= due && !runtime.carrying) {
      launchTrain(runtime, road.service)

      // Its next turn is one full trip round the pool away. A train that has
      // fallen behind is put back on the cadence rather than sent out twice.
      const cycle = road.trains.length * road.service.headway
      let next = due
      do {
        next += cycle
      } while (next <= road.now)
      road.dueAway[slot] = next
    }

    stepTrain(runtime, road.service, road.schedule, delta)
  })
}

/**
 * Run the service forward before the first frame is drawn.
 *
 * Without this the line starts empty and fills up over the ten minutes a
 * working takes end to end: the player would stand at Rajiv Chowk watching
 * eastbound trains while nothing came the other way, because the first
 * westbound train of the session would still be six kilometres away. Warming
 * up means the player arrives at a line that has been running all morning.
 */
function warmUp(road: Road): void {
  const seconds = workingSeconds(road.service, road.schedule) + road.service.headway
  for (let elapsed = 0; elapsed < seconds; elapsed += WARM_UP_STEP) {
    stepRoad(road, WARM_UP_STEP)
  }
}

/** Every road of a corridor, worked and already running. */
export function createLineService(
  corridor: CorridorConfig,
  service: ServiceConfig,
  stock: RollingStockConfig,
): Map<string, Road> {
  const roads = new Map<string, Road>()

  corridor.tracks.forEach((track, index) => {
    const road = createRoad(corridor, service, stock, index)
    warmUp(road)
    roads.set(track.id, road)
  })

  return roads
}

/**
 * The floor of every train on the line. Merged into the station floors, this
 * is what lets the player walk out of a station and into a coach without
 * anything having to switch modes (PLAN.md §5, §12).
 */
export function serviceWalkVolume(roads: ReadonlyMap<string, Road>): WalkVolume {
  const volumes: WalkVolume[] = []
  for (const road of roads.values()) {
    for (const carriage of road.carriages) volumes.push(carriage.volume)
  }
  return mergeVolumes(...volumes)
}

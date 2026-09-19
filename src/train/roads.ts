import { createContext, useContext } from 'react'
import type { ServiceConfig } from '../data/types'
import type { Carriage } from './carriage'
import type { RoadSchedule } from './line'
import type { TrainRuntime } from './service'

/**
 * The roads of the line and the trains working them.
 *
 * Everything that tells a passenger about a train — the destination board, the
 * platform announcements, later the HUD and the map — has to say the same
 * thing at the same moment, so none of them may run a clock of their own. They
 * all read the trains for their road out of here instead (PLAN.md §16).
 *
 * A road is worked by a small fleet rather than by one train, because the
 * corridor is long enough to hold several at once: while one stands at Mandi
 * House another is running in to Rajiv Chowk behind it, exactly as on the real
 * line. `ServiceClock` is what puts them in and steps them.
 */

/** One road worked as a service: the run it makes, and the trains making it. */
export interface Road {
  schedule: RoadSchedule
  /** Performance and stop timings for the line working this road (PLAN.md §7). */
  service: ServiceConfig
  /** Every train the road has, in service or standing by out of sight. */
  trains: TrainRuntime[]
  /** The saloon of each of those trains, as floor the player can stand on. */
  carriages: Carriage[]
  /** Clock time each of those trains is next due away, parallel to `trains`. */
  dueAway: number[]
  /** Seconds the service has been running, warm-up included. */
  now: number
}

export const RoadsContext = createContext<ReadonlyMap<string, Road> | null>(null)

/** Every road the line is working, or null outside a `ServiceClock`. */
export function useRoads(): ReadonlyMap<string, Road> | null {
  return useContext(RoadsContext)
}

/** The service working one road, or null if nothing is working it. */
export function useRoad(trackId: string): Road | null {
  return useContext(RoadsContext)?.get(trackId) ?? null
}

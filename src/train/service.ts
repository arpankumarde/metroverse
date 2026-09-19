import type { ServiceConfig } from '../data/types'
import type { RoadSchedule } from './line'

/**
 * The train movement state machine (PLAN.md §7).
 *
 * This is the source of truth for where a train is and what it is doing. It
 * knows nothing about three.js: it is plain numbers stepped by a delta, so the
 * digital display, the announcements, the HUD and the player's dot on the map
 * can all be derived from the same run rather than driven independently
 * (PLAN.md §16).
 *
 * One working is one trip across the built corridor, calling at every station
 * on the way. Between two stations the train drives the whole distance — the
 * states below are all there is, and none of them moves it by any other means:
 *
 *   IDLE -> CRUISING -> BRAKING -> ARRIVING -> STOPPED -> DOORS_OPEN
 *        -> DOORS_CLOSING -> DEPARTING -> ACCELERATING -> (next station)
 *        ... -> CRUISING off the end of the line -> IDLE
 */

export const TrainState = {
  /** Out of service, waiting on its next turn. */
  IDLE: 'IDLE',
  DOORS_OPEN: 'DOORS_OPEN',
  DOORS_CLOSING: 'DOORS_CLOSING',
  /** Doors shut, brakes coming off, not yet moving. */
  DEPARTING: 'DEPARTING',
  ACCELERATING: 'ACCELERATING',
  CRUISING: 'CRUISING',
  BRAKING: 'BRAKING',
  /** The last few seconds, crawling along the platform on to the mark. */
  ARRIVING: 'ARRIVING',
  STOPPED: 'STOPPED',
} as const

export type TrainState = (typeof TrainState)[keyof typeof TrainState]

export interface TrainRuntime {
  state: TrainState
  /** Seconds spent in the current state. */
  elapsed: number
  /** How far the train has run, in metres from the point it appeared. */
  travel: number
  /** Speed in m/s. Never negative; a train only ever works forwards. */
  speed: number
  /** How far the doors are open: 0 shut, 1 fully open. */
  doors: number
  /**
   * The call the train is working towards, or standing at. Equal to the
   * number of calls on the road once the last one has been left, which is
   * what makes the run out to the end of the line a non-stop one.
   */
  call: number
  /**
   * Whether the player is aboard. Written by whatever is drawing the train,
   * from the floor they are actually standing on; the state machine reads it
   * only to decide that it must not run off the end of the line with them.
   */
  carrying: boolean
}

/** Speed below which a braking train is taken to have stopped, in m/s. */
const STANDSTILL = 0.02

/** How far it takes to stop from `speed` at a constant `rate`. */
function stoppingDistance(speed: number, rate: number): number {
  return (speed * speed) / (2 * rate)
}

/** The constant rate that would just stop a train in the distance left. */
function rateToStopIn(speed: number, distance: number): number {
  return distance > 0 ? (speed * speed) / (2 * distance) : Number.POSITIVE_INFINITY
}

function enter(runtime: TrainRuntime, state: TrainState): void {
  runtime.state = state
  runtime.elapsed = 0
}

/**
 * Change speed at a constant rate and cover the ground that implies.
 *
 * Distance uses the average of the speed before and after the step rather than
 * either end of it, so the train covers the same ground at 30 fps as at 144 and
 * lands on its stopping mark either way.
 */
function advance(runtime: TrainRuntime, rate: number, limit: number, delta: number): void {
  const before = runtime.speed
  runtime.speed = Math.min(Math.max(before + rate * delta, 0), limit)
  runtime.travel += ((before + runtime.speed) / 2) * delta
}

/** How far the train still has to run before the mark it is heading for. */
function distanceToCall(runtime: TrainRuntime, schedule: RoadSchedule): number | null {
  const call = schedule.calls[runtime.call]
  return call ? call.at - runtime.travel : null
}

/** A train out of service, waiting to be launched into its next working. */
export function createTrainRuntime(): TrainRuntime {
  return {
    state: TrainState.IDLE,
    elapsed: 0,
    travel: 0,
    speed: 0,
    doors: 0,
    call: 0,
    carrying: false,
  }
}

/**
 * Put a train into service at the start of the road, running in at line speed
 * from beyond the end of the built line.
 */
export function launchTrain(runtime: TrainRuntime, config: ServiceConfig): void {
  runtime.travel = 0
  runtime.speed = config.lineSpeed
  runtime.doors = 0
  runtime.call = 0
  enter(runtime, TrainState.CRUISING)
}

/** Advance one train by `delta` seconds. Mutates `runtime` in place. */
export function stepTrain(
  runtime: TrainRuntime,
  config: ServiceConfig,
  schedule: RoadSchedule,
  delta: number,
): void {
  runtime.elapsed += delta

  switch (runtime.state) {
    case TrainState.IDLE:
      // The clock decides when a train is wanted; see `launchTrain`.
      break

    case TrainState.CRUISING: {
      advance(runtime, 0, config.lineSpeed, delta)

      const remaining = distanceToCall(runtime, schedule)
      if (remaining === null) {
        // Nothing left to call at: run off the end of the line and stand down.
        if (runtime.travel >= schedule.length) {
          runtime.speed = 0
          enter(runtime, TrainState.IDLE)
        }
      } else if (stoppingDistance(runtime.speed, config.braking) >= remaining) {
        // Brake as late as the service rate allows, so the run-in reads as one
        // continuous approach instead of a long crawl from the fog.
        enter(runtime, TrainState.BRAKING)
      }
      break
    }

    case TrainState.BRAKING:
    case TrainState.ARRIVING: {
      const remaining = distanceToCall(runtime, schedule) ?? 0

      // Hold the service rate, but take whatever more is needed if the train is
      // running late on to the mark, so it always stops at the same place.
      const rate = Math.max(config.braking, rateToStopIn(runtime.speed, remaining))
      advance(runtime, -rate, config.lineSpeed, delta)

      if (remaining <= 0 || runtime.speed <= STANDSTILL) {
        runtime.travel = schedule.calls[runtime.call]?.at ?? runtime.travel
        runtime.speed = 0
        enter(runtime, TrainState.STOPPED)
      } else if (runtime.state === TrainState.BRAKING && runtime.speed <= config.arrivingSpeed) {
        enter(runtime, TrainState.ARRIVING)
      }
      break
    }

    case TrainState.STOPPED:
      if (runtime.elapsed >= config.stopPause) enter(runtime, TrainState.DOORS_OPEN)
      break

    case TrainState.DOORS_OPEN: {
      runtime.doors = Math.min(runtime.elapsed / config.doorTravel, 1)

      // The last station on the built line is a terminus for anyone still
      // aboard: beyond it the train runs into the haze and stands down, and
      // there would be no way off. So it waits, doors open, until they step
      // out on to the platform.
      const terminates = runtime.carrying && runtime.call >= schedule.calls.length - 1

      if (runtime.elapsed >= config.doorTravel + config.dwell && !terminates) {
        enter(runtime, TrainState.DOORS_CLOSING)
      }
      break
    }

    case TrainState.DOORS_CLOSING:
      runtime.doors = Math.max(1 - runtime.elapsed / config.doorTravel, 0)
      if (runtime.elapsed >= config.doorTravel) enter(runtime, TrainState.DEPARTING)
      break

    case TrainState.DEPARTING:
      runtime.doors = 0
      if (runtime.elapsed >= config.departPause) {
        // The station has been worked; everything from here is about the next.
        runtime.call += 1
        enter(runtime, TrainState.ACCELERATING)
      }
      break

    case TrainState.ACCELERATING: {
      advance(runtime, config.acceleration, config.lineSpeed, delta)

      const remaining = distanceToCall(runtime, schedule)
      if (remaining !== null && stoppingDistance(runtime.speed, config.braking) >= remaining) {
        // Stations close enough together that the train brakes straight out of
        // its acceleration, without ever reaching line speed.
        enter(runtime, TrainState.BRAKING)
      } else if (runtime.speed >= config.lineSpeed) {
        enter(runtime, TrainState.CRUISING)
      }
      break
    }
  }
}

/** Is the train standing at a platform with the doors in play? */
export function isBerthed(state: TrainState): boolean {
  return (
    state === TrainState.STOPPED ||
    state === TrainState.DOORS_OPEN ||
    state === TrainState.DOORS_CLOSING ||
    state === TrainState.DEPARTING
  )
}

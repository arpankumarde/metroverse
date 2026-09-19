import type { ServiceConfig } from '../data/types'
import type { RoadSchedule } from './line'
import type { Road } from './roads'
import { TrainState, isBerthed, type TrainRuntime } from './service'

/**
 * How long until the next train, read off the train state machine (PLAN.md §7).
 *
 * The destination board and the platform announcements both have to answer
 * "which train, and how long?", and they must answer it identically. Neither
 * of them keeps a timetable: the question is answered here by running the
 * remaining states forward on paper, from wherever every train on the road
 * actually is — through however many stations still stand between them and
 * the platform asking.
 *
 * These are the same equations `service.ts` steps with, solved for time rather
 * than integrated, so the prediction matches what the trains then go and do
 * instead of drifting away from them.
 */

/** Seconds a train stands at a station, from stopping to pulling away. */
export function standSeconds(config: ServiceConfig): number {
  return config.stopPause + 2 * config.doorTravel + config.dwell + config.departPause
}

/**
 * Seconds to cover `distance` from `speed` and stop at the far end of it.
 *
 * The train accelerates to line speed if it has the room, and otherwise runs
 * a peaked profile that brakes straight out of its acceleration — which is
 * what `stepTrain` does between two stations that are close together. A train
 * already inside its braking distance brakes harder, exactly as it does.
 */
export function legSeconds(distance: number, speed: number, config: ServiceConfig): number {
  if (distance <= 0) return 0

  const { acceleration, braking, lineSpeed } = config
  if (speed > 0 && distance <= (speed * speed) / (2 * braking)) return (2 * distance) / speed

  const rampUp = Math.max(0, (lineSpeed * lineSpeed - speed * speed) / (2 * acceleration))
  const rampDown = (lineSpeed * lineSpeed) / (2 * braking)

  if (distance >= rampUp + rampDown) {
    return (
      Math.max(0, lineSpeed - speed) / acceleration +
      (distance - rampUp - rampDown) / lineSpeed +
      lineSpeed / braking
    )
  }

  const peak = Math.sqrt(
    (2 * acceleration * braking * distance + braking * speed * speed) /
      (acceleration + braking),
  )
  return (peak - speed) / acceleration + peak / braking
}

/** Seconds to cover `distance` pulling away from rest, without stopping. */
function runOutSeconds(distance: number, config: ServiceConfig): number {
  const { acceleration, lineSpeed } = config
  const ramp = (lineSpeed * lineSpeed) / (2 * acceleration)

  if (distance <= ramp) return Math.sqrt((2 * distance) / acceleration)
  return lineSpeed / acceleration + (distance - ramp) / lineSpeed
}

/** Seconds left of the stand a berthed train is part way through. */
function remainingStand(runtime: TrainRuntime, config: ServiceConfig): number {
  const { doorTravel, dwell, departPause } = config

  switch (runtime.state) {
    case TrainState.STOPPED:
      return (
        Math.max(0, config.stopPause - runtime.elapsed) +
        doorTravel +
        dwell +
        doorTravel +
        departPause
      )
    case TrainState.DOORS_OPEN:
      return Math.max(0, doorTravel + dwell - runtime.elapsed) + doorTravel + departPause
    case TrainState.DOORS_CLOSING:
      return Math.max(0, doorTravel - runtime.elapsed) + departPause
    case TrainState.DEPARTING:
      return Math.max(0, departPause - runtime.elapsed)
    default:
      return 0
  }
}

/**
 * Seconds until this train is standing at the given call, or Infinity if it
 * is not going to: it is out of service, or it has already been and gone.
 *
 * A train with its doors shut and its brakes coming off counts as gone, even
 * though it is still alongside the platform — a passenger watching it pull
 * out is waiting for the next one.
 */
export function secondsToCall(
  runtime: TrainRuntime,
  config: ServiceConfig,
  schedule: RoadSchedule,
  index: number,
): number {
  if (runtime.state === TrainState.IDLE || runtime.call > index) return Number.POSITIVE_INFINITY

  if (runtime.call === index) {
    if (runtime.state === TrainState.DEPARTING) return Number.POSITIVE_INFINITY
    if (isBerthed(runtime.state)) return 0
  }

  const calls = schedule.calls
  let seconds: number

  if (isBerthed(runtime.state)) {
    seconds = remainingStand(runtime, config)
  } else {
    const target = calls[runtime.call]
    if (!target) return Number.POSITIVE_INFINITY

    seconds = legSeconds(target.at - runtime.travel, runtime.speed, config)
    if (runtime.call === index) return seconds
    seconds += standSeconds(config)
  }

  for (let i = runtime.call + 1; i <= index; i++) {
    const from = calls[i - 1]
    const to = calls[i]
    if (!from || !to) return Number.POSITIVE_INFINITY

    seconds += legSeconds(to.at - from.at, 0, config)
    if (i !== index) seconds += standSeconds(config)
  }

  return seconds
}

/** Seconds from a working appearing at the start of the road to a given call. */
export function secondsFromStart(
  config: ServiceConfig,
  schedule: RoadSchedule,
  index: number,
): number {
  const first = schedule.calls[0]
  if (!first) return Number.POSITIVE_INFINITY

  // A working appears already running at line speed, out beyond the haze.
  let seconds = legSeconds(first.at, config.lineSpeed, config)

  for (let i = 1; i <= index; i++) {
    const from = schedule.calls[i - 1]
    const to = schedule.calls[i]
    if (!from || !to) return Number.POSITIVE_INFINITY

    seconds += standSeconds(config) + legSeconds(to.at - from.at, 0, config)
  }

  return seconds
}

/** Seconds one working takes from appearing to clearing the far end of the line. */
export function workingSeconds(config: ServiceConfig, schedule: RoadSchedule): number {
  const last = schedule.calls.at(-1)
  if (!last) return runOutSeconds(schedule.length, config)

  return (
    secondsFromStart(config, schedule, schedule.calls.length - 1) +
    standSeconds(config) +
    runOutSeconds(schedule.length - last.at, config)
  )
}

/**
 * Seconds until a train is standing at this station's platform, counting both
 * the trains already out on the line and the ones still to be sent out.
 */
export function secondsToArrival(road: Road, index: number): number {
  let soonest = Number.POSITIVE_INFINITY

  road.trains.forEach((runtime, slot) => {
    const seconds =
      runtime.state === TrainState.IDLE
        ? Math.max(0, (road.dueAway[slot] ?? Number.POSITIVE_INFINITY) - road.now) +
          secondsFromStart(road.service, road.schedule, index)
        : secondsToCall(runtime, road.service, road.schedule, index)

    if (seconds < soonest) soonest = seconds
  })

  return soonest
}

export const ArrivalPhase = {
  /** Platform empty, the next train still out on the line. */
  WAITING: 'WAITING',
  /** Train on final approach, in sight and running in along the platform. */
  ARRIVING: 'ARRIVING',
  /** Train standing at the platform. */
  AT_PLATFORM: 'AT_PLATFORM',
} as const

export type ArrivalPhase = (typeof ArrivalPhase)[keyof typeof ArrivalPhase]

/**
 * The train working this station now: the one standing at the platform, or
 * failing that the one running in to it.
 *
 * Both can exist at once on a busy road — one train still loading while the
 * next brakes behind it — and it is the one at the platform that the board
 * and the voice are talking about.
 */
export function trainAtCall(road: Road, index: number): TrainRuntime | null {
  let approaching: TrainRuntime | null = null

  for (const runtime of road.trains) {
    if (runtime.state === TrainState.IDLE || runtime.call !== index) continue
    if (isBerthed(runtime.state)) return runtime
    if (runtime.state === TrainState.BRAKING || runtime.state === TrainState.ARRIVING) {
      approaching ??= runtime
    }
  }

  return approaching
}

/**
 * How close the train is to being seen from the platform, which is as much
 * resolution as the board and the announcements need.
 */
export function arrivalPhase(road: Road, index: number): ArrivalPhase {
  const runtime = trainAtCall(road, index)
  if (!runtime) return ArrivalPhase.WAITING

  switch (runtime.state) {
    case TrainState.STOPPED:
    case TrainState.DOORS_OPEN:
    case TrainState.DOORS_CLOSING:
      return ArrivalPhase.AT_PLATFORM

    case TrainState.BRAKING:
    case TrainState.ARRIVING:
      return ArrivalPhase.ARRIVING

    default:
      return ArrivalPhase.WAITING
  }
}

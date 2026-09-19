import { corridorAlignment, railPitch, railY } from '../data/alignment'
import { corridorEnd, corridorStart } from '../data/corridor'
import type { CorridorConfig, TrackConfig, VerticalAlignment } from '../data/types'
import { platformForTrack, platformLayout } from '../stations/geometry'

/**
 * One road of the corridor turned into the run a train actually makes: where
 * it appears, the stopping marks it calls at in the order it reaches them,
 * and where it disappears again (PLAN.md §7).
 *
 * Distances are measured along the run rather than along world +X, so both
 * roads work the same simulation and only the renderer has to know which way
 * round each of them is.
 */

export interface Call {
  stationId: string
  platformId: string
  /** Distance from the point a working appears to this stopping mark, in metres. */
  at: number
}

export interface RoadSchedule {
  trackId: string
  /** Which way this road works: +1 travels towards +X, -1 towards -X. */
  direction: 1 | -1
  /** Which side of the track its platforms are on: +1 for +Z, -1 for -Z. */
  platformSide: 1 | -1
  /** Z of this road's centreline, which is where its trains run. */
  offsetZ: number
  /** The stations this road calls at, in the order it reaches them. */
  calls: Call[]
  /** Length of one working, from appearing to disappearing, in metres. */
  length: number
  /** World X of the point a working appears. */
  originX: number
  /** How the line rises and falls under this road (PLAN.md §6). */
  alignment: VerticalAlignment
}

/**
 * The run one road makes across the corridor.
 *
 * A train stops with its centre on the station centre, so a station's
 * chainage is its stopping mark, and the platforms are read straight off the
 * stations to find which side of the train opens.
 */
export function roadSchedule(corridor: CorridorConfig, track: TrackConfig): RoadSchedule {
  const start = corridorStart(corridor)
  const end = corridorEnd(corridor)
  const originX = track.direction === 1 ? start : end

  const ordered =
    track.direction === 1 ? corridor.stations : [...corridor.stations].reverse()

  let platformSide: 1 | -1 | null = null

  const calls = ordered.map(({ station, x }) => {
    const platform = platformForTrack(station, track.id)
    const { sideSign } = platformLayout(platform, track)

    // One train has one set of doors working, so a road whose platforms
    // swapped sides part way along would need a train that knew where it was.
    if (platformSide !== null && sideSign !== platformSide) {
      throw new Error(`Road ${track.id} has platforms on both sides of the train`)
    }
    platformSide = sideSign

    return {
      stationId: station.id,
      platformId: platform.id,
      at: Math.abs(x - originX),
    }
  })

  if (platformSide === null) throw new Error(`Road ${track.id} calls nowhere`)

  return {
    trackId: track.id,
    direction: track.direction,
    platformSide,
    offsetZ: track.offset,
    calls,
    length: end - start,
    originX,
    alignment: corridorAlignment(corridor),
  }
}

/** Where a train that has run `travel` down the road is, in world X. */
export function worldX(schedule: RoadSchedule, travel: number): number {
  return schedule.originX + travel * schedule.direction
}

/**
 * How high rail top is there, and how steeply the line is falling.
 *
 * Placing a train is three numbers rather than one, because the line dives
 * into tunnel and climbs back out (PLAN.md §6). They live next to `worldX`
 * so that everything that puts a train somewhere — the renderer, the floor
 * the player stands on — reads all three from the same place and cannot end
 * up with a saloon floor at one height and a car body at another.
 */
export function worldY(schedule: RoadSchedule, travel: number): number {
  return railY(schedule.alignment, worldX(schedule, travel))
}

/** Pitch of the train at that point, in radians, about world Z. */
export function worldPitch(schedule: RoadSchedule, travel: number): number {
  // The alignment is written along +X, and so is the pitch that comes out of
  // it: a train working the other way is turned around by the renderer, and
  // turning it flips this with everything else.
  return railPitch(schedule.alignment, worldX(schedule, travel))
}

/** Which call a station is on this road, or -1 if the road does not call there. */
export function callAt(schedule: RoadSchedule, stationId: string): number {
  return schedule.calls.findIndex((call) => call.stationId === stationId)
}

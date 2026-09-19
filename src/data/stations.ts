import { BLUE_LINE } from './lines'
import { BLUE_ROUTE, routeStationName, routeTerminal } from './route'
import {
  PlatformSide,
  type CanopyConfig,
  type PlatformConfig,
  type StationConfig,
  type TrackConfig,
} from './types'

/**
 * How a Blue Line station is built, as opposed to where it is on the line
 * (`corridor.ts`) or what it is called (`route.ts`).
 *
 * Every station on the stretch is the DMRC standard elevated island of two
 * centre tracks flanked by a side platform each, under one barrel vault, so
 * they are all struck from the same template and differ only in their name.
 * A station that needs its own arrangement overrides the template here rather
 * than anywhere in `stations/` (PLAN.md §9, §33).
 */

/**
 * Track centres sit 4 m apart, which clears the 2.9 m cars with room for the
 * central columns that come later.
 */
const TRACK_SPACING = 4

const PLATFORM_LENGTH = 180
const PLATFORM_WIDTH = 8

/** Platform outer edge, and therefore where the canopy springs from. */
const STATION_HALF_WIDTH = TRACK_SPACING / 2 + 1.55 + PLATFORM_WIDTH

/**
 * The two running lines of the Blue Line, continuous through every station on
 * the corridor: road 1 works towards Dwarka, road 2 towards Noida, with +X
 * taken as the Noida end of the line.
 */
export const BLUE_ROADS: TrackConfig[] = [
  { id: 'blue-r1', offset: -TRACK_SPACING / 2, direction: -1, gauge: 1.435, sleeperSpacing: 0.65 },
  { id: 'blue-r2', offset: TRACK_SPACING / 2, direction: 1, gauge: 1.435, sleeperSpacing: 0.65 },
]

const CANOPY: CanopyConfig = {
  length: 196,
  halfSpan: STATION_HALF_WIDTH + 0.35,
  springY: 3.6,
  rise: 5.4,
  thickness: 0.22,
  ribSpacing: 6.3,
  ribRadius: 0.13,
}

/**
 * A platform serving one road, on the outboard side of it. Its number and the
 * destination printed on its board both come from which way that road works,
 * so neither is written down twice.
 */
function sidePlatform(stationId: string, track: TrackConfig, number: string): PlatformConfig {
  return {
    id: `${stationId}-p${number}`,
    trackId: track.id,
    side: track.direction === 1 ? PlatformSide.RIGHT : PlatformSide.LEFT,
    number,
    towards: routeTerminal(BLUE_ROUTE, track.direction),
    length: PLATFORM_LENGTH,
    width: PLATFORM_WIDTH,
    height: 1.1,
  }
}

/**
 * A Blue Line station, named from the route data. Building another one is a
 * matter of naming it in the corridor table — no component learns any station
 * name, and nothing here is written per station.
 */
export function blueLineStation(routeId: string): StationConfig {
  return {
    id: routeId,
    name: routeStationName(BLUE_ROUTE, routeId),
    lineId: BLUE_LINE.id,
    platforms: BLUE_ROADS.map((road, index) => sidePlatform(routeId, road, String(index + 1))),
    canopy: CANOPY,
  }
}

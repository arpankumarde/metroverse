import blueRoute from './lines/blue.json'
import blueHindi from './lines/blue-hi.json'
import type { BilingualName } from './types'

/**
 * The Metro network as published: every station on a line, in order, with the
 * interstation links that put them in that order (PLAN.md §9).
 *
 * `lines/*.json` is the whole line end to end, not the part of it that has
 * been built in 3D. Which stretch is modelled, and where each station sits on
 * the ground, is `corridor.ts`; this file is only the route, and it is the one
 * place station names and orderings come from.
 *
 * The JSON carries the English names as they are printed on DMRC signage. The
 * Devanagari that goes above them on every sign is a sidecar keyed by the same
 * station id, so a new station is added by editing the route and adding its
 * Hindi name beside it.
 */

export const StationStructure = {
  ELEVATED: 'elevated',
  UNDERGROUND: 'underground',
  AT_GRADE: 'at-grade',
} as const

export type StationStructure = (typeof StationStructure)[keyof typeof StationStructure]

export interface RouteStation {
  /** Position in the route, counting from the first terminal. */
  sequence: number
  id: string
  name: string
  structure: StationStructure
  isTerminal: boolean
  previous: string | null
  next: string | null
}

export interface LineRoute {
  id: string
  name: string
  color: string
  stations: RouteStation[]
}

const STRUCTURES: Record<string, StationStructure> = {
  elevated: StationStructure.ELEVATED,
  underground: StationStructure.UNDERGROUND,
  'at-grade': StationStructure.AT_GRADE,
}

/** The published route, checked into the shape the rest of the app expects. */
function readRoute(source: typeof blueRoute): LineRoute {
  return {
    id: source.id,
    name: source.name,
    color: source.color,
    stations: source.route.stations.map((station) => {
      const structure = STRUCTURES[station.type]
      if (!structure) {
        throw new Error(`Station ${station.id} has unknown structure "${station.type}"`)
      }

      return {
        sequence: station.sequence,
        id: station.id,
        name: station.name,
        structure,
        isTerminal: station.isTerminal,
        previous: station.previous,
        next: station.next,
      }
    }),
  }
}

export const BLUE_ROUTE: LineRoute = readRoute(blueRoute)

const HINDI: Record<string, string> = blueHindi

export function routeStation(route: LineRoute, id: string): RouteStation {
  const station = route.stations.find((candidate) => candidate.id === id)
  if (!station) throw new Error(`${route.name} has no station "${id}"`)
  return station
}

/**
 * A station's name as it appears on a sign: Devanagari above, Latin below.
 *
 * A missing Hindi name is a hole in the data rather than something to paper
 * over — every sign in the station is bilingual, so half a name would be
 * wrong on screen everywhere the station is named.
 */
export function routeStationName(route: LineRoute, id: string): BilingualName {
  const station = routeStation(route, id)
  const hi = HINDI[station.id]
  if (!hi) {
    throw new Error(`Station ${station.id} has no Hindi name in src/data/lines/blue-hi.json`)
  }

  return { hi, en: station.name }
}

/**
 * Where trains working in `direction` are ultimately headed, as printed on the
 * destination boards: the terminal that way along the route.
 *
 * +1 runs towards the end of the route as the data lists it, -1 back towards
 * its start.
 */
export function routeTerminal(route: LineRoute, direction: 1 | -1): BilingualName {
  const terminal = direction === 1 ? route.stations.at(-1) : route.stations[0]
  if (!terminal) throw new Error(`${route.name} has no stations`)
  return routeStationName(route, terminal.id)
}

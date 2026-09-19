import { checkAlignment } from './alignment'
import { BLUE_LINE } from './lines'
import { BLUE_ROUTE, routeStation } from './route'
import { BLUE_ROADS, blueLineStation } from './stations'
import type { CorridorConfig, CorridorStation, GradePoint, VerticalAlignment } from './types'

/**
 * The stretch of the Blue Line that is actually built in 3D (PLAN.md §30
 * phase 3), and where each of its stations stands on the ground.
 *
 * Distances are the real interstation distances, to the nearest ten metres:
 * the point of building the line rather than one station is that a train
 * leaving Rajiv Chowk takes as long to reach Barakhamba Road as it does in
 * Delhi, and arrives there because it drove the whole way (PLAN.md §7).
 *
 * Extending the corridor — eastwards to Akshardham, or back west towards
 * Dwarka — is a matter of adding a line to the table below and a Hindi name
 * to `lines/blue-hi.json`. Nothing else in the app knows which stations exist.
 */

interface Placement {
  /** Station id, as the route data spells it. */
  id: string
  /** Distance from the previous station in the table, in metres. */
  gap: number
}

const BLUE_STRETCH: Placement[] = [
  { id: 'rajiv_chowk', gap: 0 },
  { id: 'barakhamba_road', gap: 760 },
  { id: 'mandi_house', gap: 1060 },
  { id: 'supreme_court', gap: 1200 },
  { id: 'indraprastha', gap: 1150 },
  { id: 'yamuna_bank', gap: 1850 },
]

/**
 * How far the built line runs past the outermost stations, in metres.
 *
 * Comfortably beyond the far edge of the haze, so a working appears and
 * disappears out of sight rather than popping into existence, and with room
 * to brake from line speed on the way in. Long enough, too, to hold the ramp
 * down into the tunnel at the Dwarka end: a working now appears inside that
 * tunnel, out of sight of anything, and runs out into daylight.
 */
const TAIL = 820

/**
 * Rail top at the bottom of a tunnel, below rail top on the viaduct.
 *
 * Fixed by what has to fit above the train and below the road. The soffit
 * clears the 3.95 m car roof with room for the overhead; the roof slab is
 * above that; and the whole box has to be under the street, which is itself
 * 9.2 m below the viaduct. See `tunnelGeometry.ts`, which builds the box to
 * match.
 */
const TUNNEL_DEPTH = 15.5

/**
 * Length of the ramp between viaduct level and tunnel depth, in metres.
 *
 * 480 m for a 15.5 m fall is a ruling gradient of 4.8%, which is steep for a
 * metro but within what is built — and it is what the gaps between these
 * stations will take. A longer ramp needs a longer gap, and there is not one.
 */
const TUNNEL_RAMP = 480

/**
 * Where the Blue Line leaves the viaduct and goes under (PLAN.md §6, §19).
 *
 * `to` naming an end of the built line rather than a chainage means the line
 * stays down: the Dwarka end of this stretch runs on into the dark towards
 * R K Ashram Marg, which is where the real line goes, and which is why a
 * train appears out of a tunnel mouth rather than out of the haze.
 */
interface Dive {
  id: string
  /** Chainage where the line leaves viaduct level, heading down. */
  from: number
  /**
   * Chainage where it is back at viaduct level, or which end of the built
   * line it runs on to at depth without ever climbing out.
   */
  to: number | 'start' | 'end'
}

const BLUE_DIVES: Dive[] = [
  // West of Rajiv Chowk, under Connaught Place towards R K Ashram Marg.
  { id: 'rk-ashram-bound', from: -120, to: 'start' },
  // Mandi House to Supreme Court, under Tilak Marg and the Ring Road.
  { id: 'tilak-marg', from: 1930, to: 2910 },
]

/**
 * The dives turned into the grade points the rest of the app reads.
 *
 * A dive with both ends is a ramp down, a short level bottom and a ramp back
 * up; a dive with one end is a ramp down and no coming back. The level bottom
 * is whatever the gap leaves over once both ramps have had their length,
 * which is the honest way round: the ramp gradient is the thing that must not
 * be compromised, so it is the thing that is written down.
 */
function grade(dives: readonly Dive[], start: number, end: number): GradePoint[] {
  const points: GradePoint[] = []

  for (const dive of dives) {
    // Which way the line is falling: towards whichever end the dive runs to.
    const runsTo = dive.to === 'start' ? start : dive.to === 'end' ? end : dive.to
    const down = dive.from < runsTo ? 1 : -1
    const foot = dive.from + down * TUNNEL_RAMP

    if (typeof dive.to !== 'number') {
      // Running on at depth: the far end of the built line is the far end of
      // the tunnel, and it has to be beyond the foot of the ramp.
      if (down * (runsTo - foot) < 0) {
        throw new Error(`Tunnel ${dive.id} has no room for its ramp inside the built line`)
      }
      points.push({ x: dive.from, y: 0 }, { x: foot, y: -TUNNEL_DEPTH })
      continue
    }

    const head = dive.to - down * TUNNEL_RAMP
    if (down * (head - foot) < 0) {
      throw new Error(`Tunnel ${dive.id} is too short for two ${TUNNEL_RAMP} m ramps`)
    }

    points.push(
      { x: dive.from, y: 0 },
      { x: foot, y: -TUNNEL_DEPTH },
      { x: head, y: -TUNNEL_DEPTH },
      { x: dive.to, y: 0 },
    )
  }

  return points.sort((a, b) => a.x - b.x)
}

/** Chainage is measured along +X from the first station in the table. */
function place(stretch: Placement[]): CorridorStation[] {
  let x = 0
  let previousSequence = -1

  return stretch.map((placement) => {
    const { sequence } = routeStation(BLUE_ROUTE, placement.id)
    if (sequence <= previousSequence) {
      throw new Error(`Corridor station ${placement.id} is out of route order`)
    }

    previousSequence = sequence
    x += placement.gap

    return { station: blueLineStation(placement.id), x }
  })
}

const BLUE_STATIONS = place(BLUE_STRETCH)

const BLUE_ALIGNMENT: VerticalAlignment = grade(
  BLUE_DIVES,
  (BLUE_STATIONS[0]?.x ?? 0) - TAIL,
  (BLUE_STATIONS.at(-1)?.x ?? 0) + TAIL,
)

export const BLUE_CORRIDOR: CorridorConfig = {
  id: 'blue-central',
  lineId: BLUE_LINE.id,
  tracks: BLUE_ROADS,
  stations: BLUE_STATIONS,
  alignment: BLUE_ALIGNMENT,
  tail: TAIL,
}

// A ramp running under a platform would berth every train at that station on
// a slope. Caught once, here, rather than by walking into a sloping doorway.
checkAlignment(BLUE_CORRIDOR, BLUE_ALIGNMENT)

function outermost(corridor: CorridorConfig): [CorridorStation, CorridorStation] {
  const first = corridor.stations[0]
  const last = corridor.stations.at(-1)
  if (!first || !last) throw new Error(`Corridor ${corridor.id} has no stations`)
  return [first, last]
}

/** X where the built line begins, i.e. the far end of the westbound tail. */
export function corridorStart(corridor: CorridorConfig): number {
  return outermost(corridor)[0].x - corridor.tail
}

/** X where the built line ends, i.e. the far end of the eastbound tail. */
export function corridorEnd(corridor: CorridorConfig): number {
  return outermost(corridor)[1].x + corridor.tail
}

export function corridorLength(corridor: CorridorConfig): number {
  return corridorEnd(corridor) - corridorStart(corridor)
}

export function corridorStation(corridor: CorridorConfig, stationId: string): CorridorStation {
  const found = corridor.stations.find((entry) => entry.station.id === stationId)
  if (!found) throw new Error(`Corridor ${corridor.id} does not include ${stationId}`)
  return found
}

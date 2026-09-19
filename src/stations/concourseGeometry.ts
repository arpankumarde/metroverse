import type { Vec3 } from '../components/InstancedParts'
import { CONCOURSE } from '../data/access'
import type { StationConfig, TrackConfig } from '../data/types'
import type { WalkArea, WalkObstacle } from '../systems/walk'
import { accessFlightAreas, accessLayouts, type AccessLayout } from './accessGeometry'
import { boxOver, rectsAround, type Box, type Rect } from './deck'
import { trackById } from './geometry'
import { DECK_BOTTOM_Y, PIER_SIZE } from './viaductGeometry'

/**
 * The concourse: the hall under a station's platforms where the staircases and
 * escalators land, and where a passenger crosses from one platform to the
 * other (PLAN.md §8, §11).
 *
 * It fills the space between the street and the deck, closed in by the deck
 * above it, so it is a floor, four walls and the flights coming down through
 * its ceiling. Like the platforms it is derived from the StationConfig alone:
 * it is as long as the flights need, and as wide as they are apart.
 *
 * Everything is in station-local coordinates, like the platforms, and is put
 * on the line by the same group transform.
 */

const WALL_THICKNESS = 0.3

/** Structural slab under the floor finish, which is what the street sees. */
const SLAB_THICKNESS = 0.6
const FINISH_LIFT = 0.006

/** Walls run this far up into the deck, so there is no crack of daylight at the top. */
const WALL_EMBED = 0.2

/**
 * The false ceiling hung just under the deck, so the hall reads as a finished
 * room and not as the raw underside of a viaduct.
 */
const CEILING_THICKNESS = 0.03

/** Ceiling light panels: size along the hall, and how far apart they are pitched. */
const LIGHT_LENGTH = 2.2
const LIGHT_PITCH = 3.6
const LIGHT_WIDTH = 0.34
const LIGHT_DROP = 0.05

/** Clear space kept round the flights' wells, so no panel is half in the hole. */
const LIGHT_CLEARANCE = 0.5

/** Rows of ceiling lights, as distances from the middle of the hall. */
const LIGHT_ROWS = [-9.3, -3.4, 3.4, 9.3] as const

/** A hanging platform sign: height of its centre above the floor. */
const SIGN_CENTER_ABOVE_FLOOR = 2.45

export interface DirectionSign {
  platformId: string
  /** Station-local centre of the board. */
  position: Vec3
  /** Rotation about Y so the board faces out into the hall. */
  facing: number
}

export interface ConcourseLayout {
  /** The walkable floor of the hall, in plan. */
  hall: Rect
  floorY: number
  /** Underside of the viaduct deck, which is the ceiling. */
  ceilingY: number
  flights: AccessLayout[]
  /** Structural slab, and the finish laid on top of it. */
  slab: Box
  finish: Box
  walls: Box[]
  /** The false ceiling, in the pieces left once the flights' wells are cut out. */
  ceiling: Box[]
  /** Centres of the ceiling light panels. */
  lights: Vec3[]
  lightSize: Vec3
  signs: DirectionSign[]
}

function flightsOf(station: StationConfig, tracks: readonly TrackConfig[]): AccessLayout[] {
  return station.platforms.flatMap((platform) =>
    accessLayouts(platform, trackById(tracks, platform.trackId)),
  )
}

/**
 * The hall's plan, from what it has to hold: the outermost foot of a flight at
 * either end plus room to stand, and the outermost balustrade at either side
 * plus a hand's width to the wall.
 */
function hallRect(flights: readonly AccessLayout[]): Rect {
  if (flights.length === 0) throw new Error('A concourse needs at least one flight to serve')

  return {
    minX: Math.min(...flights.map((f) => f.footprint.minX)) - CONCOURSE.overrun,
    maxX: Math.max(...flights.map((f) => f.footprint.maxX)) + CONCOURSE.overrun,
    minZ: Math.min(...flights.map((f) => f.well.minZ)) - CONCOURSE.sideRoom,
    maxZ: Math.max(...flights.map((f) => f.well.maxZ)) + CONCOURSE.sideRoom,
  }
}

/** Do two rectangles come within `margin` of each other? */
function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return (
    a.minX - margin < b.maxX &&
    a.maxX + margin > b.minX &&
    a.minZ - margin < b.maxZ &&
    a.maxZ + margin > b.minZ
  )
}

export function concourseLayout(
  station: StationConfig,
  tracks: readonly TrackConfig[],
): ConcourseLayout {
  const flights = flightsOf(station, tracks)
  const hall = hallRect(flights)
  const floorY = CONCOURSE.floorY
  const ceilingY = DECK_BOTTOM_Y

  // The slab reaches out under the walls, which stand on it.
  const outer: Rect = {
    minX: hall.minX - WALL_THICKNESS,
    maxX: hall.maxX + WALL_THICKNESS,
    minZ: hall.minZ - WALL_THICKNESS,
    maxZ: hall.maxZ + WALL_THICKNESS,
  }

  const wallTop = ceilingY + WALL_EMBED
  const walls: Box[] = [
    boxOver({ ...outer, maxX: hall.minX }, floorY, wallTop),
    boxOver({ ...outer, minX: hall.maxX }, floorY, wallTop),
    boxOver({ minX: hall.minX, maxX: hall.maxX, minZ: outer.minZ, maxZ: hall.minZ }, floorY, wallTop),
    boxOver({ minX: hall.minX, maxX: hall.maxX, minZ: hall.maxZ, maxZ: outer.maxZ }, floorY, wallTop),
  ]

  const centerZ = (hall.minZ + hall.maxZ) / 2
  const lights: Vec3[] = []
  for (
    let x = hall.minX + LIGHT_PITCH / 2;
    x + LIGHT_LENGTH / 2 < hall.maxX;
    x += LIGHT_PITCH
  ) {
    for (const row of LIGHT_ROWS) {
      const z = centerZ + row
      const panel: Rect = {
        minX: x - LIGHT_LENGTH / 2,
        maxX: x + LIGHT_LENGTH / 2,
        minZ: z - LIGHT_WIDTH / 2,
        maxZ: z + LIGHT_WIDTH / 2,
      }
      if (z < hall.minZ + 0.6 || z > hall.maxZ - 0.6) continue
      if (flights.some((flight) => overlaps(panel, flight.well, LIGHT_CLEARANCE))) continue
      lights.push([x, ceilingY - LIGHT_DROP / 2, z])
    }
  }

  return {
    hall,
    floorY,
    ceilingY,
    flights,
    slab: boxOver(outer, floorY - SLAB_THICKNESS, floorY),
    finish: boxOver(outer, floorY, floorY + FINISH_LIFT),
    walls,
    ceiling: rectsAround(
      hall,
      flights.map((flight) => flight.well),
    ).map((rect) => boxOver(rect, ceilingY - CEILING_THICKNESS, ceilingY)),
    lights,
    lightSize: [LIGHT_LENGTH, LIGHT_DROP, LIGHT_WIDTH],
    signs: directionSigns(station, flights, floorY),
  }
}

/**
 * One board per platform, hung in the gap between its escalators and its
 * staircase, facing back across the hall towards the person about to choose.
 */
function directionSigns(
  station: StationConfig,
  flights: readonly AccessLayout[],
  floorY: number,
): DirectionSign[] {
  return station.platforms.flatMap((platform) => {
    const its = flights.filter((flight) => flight.id.startsWith(`${platform.id}-`))
    if (its.length === 0) return []

    // Between the heads of the flights: the one place with ceiling to hang from
    // that every one of the platform's flights is a short walk from.
    const heads = its.map((flight) => flight.headX).sort((a, b) => a - b)
    const x = ((heads[0] ?? 0) + (heads[heads.length - 1] ?? 0)) / 2
    const z = its.reduce((sum, flight) => sum + flight.centerZ, 0) / its.length

    // Faces the middle of the hall, whichever side of it the platform is on.
    const facing = z < 0 ? 0 : Math.PI

    return [{ platformId: platform.id, position: [x, floorY + SIGN_CENTER_ABOVE_FLOOR, z], facing }]
  })
}

/**
 * The hall floor as somewhere to walk: the whole hall except the wells of the
 * flights, which have their own floors at their own heights.
 *
 * Where a flight lands, its floor and the hall's meet along one edge that
 * comes from the same number on both sides, so there is no seam to catch on.
 */
export function concourseAreas(
  station: StationConfig,
  tracks: readonly TrackConfig[],
): WalkArea[] {
  const layout = concourseLayout(station, tracks)

  return rectsAround(
    layout.hall,
    layout.flights.map((flight) => flight.well),
  ).map((rect, index) => ({
    id: `${station.id}-hall-${index}`,
    ...rect,
    floorY: layout.floorY,
  }))
}

/** The flights of every platform as floors, so a station's volume has them all. */
export function stationFlightAreas(
  station: StationConfig,
  tracks: readonly TrackConfig[],
): WalkArea[] {
  return station.platforms.flatMap((platform) =>
    accessFlightAreas(platform, trackById(tracks, platform.trackId)),
  )
}

/**
 * Viaduct piers that come up through the hall. They stand on the centreline,
 * between the two roads, so a player crossing from one platform to the other
 * has to go round them; a person on the platform above, or in a train, does not
 * — which is what the height range is for.
 *
 * `piers` are chainages on the line, and `x` is where the station stands.
 */
export function concourseObstacles(
  station: StationConfig,
  tracks: readonly TrackConfig[],
  x: number,
  piers: readonly number[],
): WalkObstacle[] {
  const { hall, floorY, ceilingY } = concourseLayout(station, tracks)
  const halfLength = PIER_SIZE[0] / 2
  const halfWidth = PIER_SIZE[1] / 2

  return piers
    .map((chainage) => chainage - x)
    .filter((local) => local + halfLength > hall.minX && local - halfLength < hall.maxX)
    .map((local, index) => ({
      id: `${station.id}-pier-${index}`,
      minX: local - halfLength,
      maxX: local + halfLength,
      minZ: -halfWidth,
      maxZ: halfWidth,
      bottomY: floorY - SLAB_THICKNESS,
      topY: ceilingY,
    }))
}

/**
 * The holes a station needs cut through the viaduct deck, in station-local
 * plan: one round each flight, from where it leaves the platform to where it
 * lands.
 */
export function deckCuts(station: StationConfig, tracks: readonly TrackConfig[]): Rect[] {
  return flightsOf(station, tracks).map((flight) => flight.well)
}

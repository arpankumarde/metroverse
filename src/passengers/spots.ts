import { Travel } from '../data/access'
import type { PlatformConfig, RollingStockConfig, TrackConfig } from '../data/types'
import { accessLayouts } from '../stations/accessGeometry'
import { BENCH_LENGTH, BENCH_SEAT_Y, platformFittings } from '../stations/fittings'
import { PLATFORM_EDGE_OFFSET, platformLayout } from '../stations/geometry'
import type { WalkObstacle } from '../systems/walk'
import {
  carCenters,
  doorCentersX,
  innerHalfWidth,
  saloonHalfLength,
  sideBays,
} from '../train/geometry'

/**
 * Everywhere a person can be: the places they stand and sit, derived from the
 * same config the platforms and the saloon are drawn from (PLAN.md §18).
 *
 * A crowd is only convincing if it is standing in the right places — behind
 * the tactile strip, beside the doorways rather than in front of them, on the
 * benches that are actually there, along the bench line inside the coach. So
 * none of it is authored: the seats come out of the bays the benches are
 * built in, the queues come out of where the doors will be when the train
 * berths, and the way off the platform comes out of where the stairs are.
 * Add a station and its crowd falls out with it (PLAN.md §9, §33).
 *
 * Nothing here knows about three.js. `crowd.ts` moves people between these
 * places and `Crowd.tsx` draws them.
 */

/** Shoulder radius, for keeping people clear of the furniture. */
export const PERSON_RADIUS = 0.26

/** Somewhere one person can be. */
export interface Spot {
  x: number
  z: number
  /** Which way they face there, in radians. Zero looks along +Z. */
  yaw: number
  /** Sat down rather than stood up. */
  seated: boolean
  /** Height of the seat pan above the floor; zero when standing. */
  seatY: number
}

/* ------------------------------------------------------------------ saloon */

/** A doorway of a berthed train, as a place people move through. */
export interface DoorBerth {
  /** Offset from the centre of the train, in metres. */
  x: number
  /** Which car it opens into. */
  car: number
}

interface CarSpots {
  seats: number[]
  standing: number[]
}

export interface SaloonSpots {
  /** Every seat and every place to stand, in the train's own frame. */
  spots: Spot[]
  /** Those spots grouped by the car they are in, as indices. */
  byCar: CarSpots[]
  /** Every doorway on the platform side, in car order. */
  doors: DoorBerth[]
  /** Saloon floor above the frame origin, which is rail top. */
  floorY: number
  /** Z just inside a doorway, once through it. */
  insideZ: number
  /** Z in the doorway itself, level with the side of the car. */
  thresholdZ: number
  /** Z out on the platform, a stride clear of the doorway. */
  landingZ: number
}

/** Seat pitch along a longitudinal bench, in metres. */
const SEAT_PITCH = 0.48

/** How far in from the ends of a bay the outermost seat sits. */
const SEAT_MARGIN = 0.26

/** Standing room: how far out from the centreline, and how far apart along it. */
const STAND_OFFSET = 0.6
const STAND_PITCH = 0.8

/** Clearance left at the ends of a car's saloon, clear of the end walls. */
const STAND_MARGIN = 0.55

/** How far past the face of the lining a person stepping in stands. */
const INSIDE_CLEARANCE = 0.55

/** How far out from the side of the car the doorway threshold is. */
const THRESHOLD_CLEARANCE = 0.3

/** How far back from the platform edge someone who has just alighted stands. */
const LANDING_SETBACK = 1.15

/** Evenly spaced points across a span, inset from both ends. */
function spread(min: number, max: number, pitch: number, margin: number): number[] {
  const from = min + margin
  const to = max - margin
  if (to <= from) return [(min + max) / 2]

  const count = Math.max(1, Math.round((to - from) / pitch))
  const step = (to - from) / count
  return Array.from({ length: count + 1 }, (_, i) => from + i * step)
}

/** Facing straight across the car, away from the side you are sat against. */
function facingAcross(side: 1 | -1): number {
  return side === 1 ? Math.PI : 0
}

/**
 * The inside of a train as places for people (PLAN.md §5, §18).
 *
 * Coordinates are the carriage's own frame, which stays square to the world:
 * a train turned round to work the other road is symmetric about both axes,
 * so the same set of seats serves either direction. The one thing that is not
 * symmetric is which side the platform is on, which is why that is the only
 * argument.
 */
export function saloonSpots(stock: RollingStockConfig, platformSide: 1 | -1): SaloonSpots {
  const innerHalf = innerHalfWidth(stock)
  const halfLength = saloonHalfLength(stock)
  const seatZ = innerHalf - stock.saloon.seatDepth / 2

  const spots: Spot[] = []
  const byCar: CarSpots[] = []
  const doors: DoorBerth[] = []

  carCenters(stock).forEach((carX, car) => {
    const seats: number[] = []
    const standing: number[] = []

    // Seats are the benches, one person every seat pitch along them. The
    // margin is wider than the clearance the bench itself is drawn with, so
    // nobody is ever sat on the very end of a pan.
    for (const bay of sideBays(stock)) {
      for (const side of [1, -1] as const) {
        for (const x of spread(bay.min, bay.max, SEAT_PITCH, SEAT_MARGIN)) {
          seats.push(spots.length)
          spots.push({
            x: carX + x,
            z: side * seatZ,
            yaw: facingAcross(side),
            seated: true,
            seatY: stock.saloon.seatHeight,
          })
        }
      }
    }

    // Standing room is two lanes down the aisle, clear of the benches on one
    // hand and of the poles down the centreline on the other.
    for (const x of spread(-halfLength, halfLength, STAND_PITCH, STAND_MARGIN)) {
      for (const side of [1, -1] as const) {
        standing.push(spots.length)
        spots.push({
          x: carX + x,
          z: side * STAND_OFFSET,
          yaw: facingAcross(side),
          seated: false,
          seatY: 0,
        })
      }
    }

    byCar.push({ seats, standing })

    for (const door of doorCentersX(stock)) doors.push({ x: carX + door, car })
  })

  return {
    spots,
    byCar,
    doors,
    floorY: stock.floorHeight,
    insideZ: platformSide * (innerHalf - INSIDE_CLEARANCE),
    thresholdZ: platformSide * (stock.carWidth / 2 + THRESHOLD_CLEARANCE),
    landingZ: platformSide * (PLATFORM_EDGE_OFFSET + LANDING_SETBACK),
  }
}

/** The doorway a spot is nearest to, as an index into `doors`. */
export function nearestDoor(spots: SaloonSpots, x: number): number {
  let best = 0
  let nearest = Number.POSITIVE_INFINITY

  spots.doors.forEach((door, index) => {
    const distance = Math.abs(door.x - x)
    if (distance < nearest) {
      nearest = distance
      best = index
    }
  })

  return best
}

/* ---------------------------------------------------------------- platform */

/** The head of a stair or an escalator: where the platform fills and empties. */
export interface Gate {
  /** Where a person stands as they step off the flight on to the deck. */
  x: number
  z: number
  /** The point out over the opening they rise from, and sink back into. */
  fromX: number
  fromZ: number
  /**
   * Z of the open standing area in front of the flights, where a route to or
   * from the gate can run without crossing any of their openings. Flights sit
   * side by side, so a straight line from one to the far side of the deck can
   * otherwise go straight over the next one.
   */
  clearZ: number
  /**
   * Which way it can be used. People come up from the concourse by a stair or an
   * up escalator and go down by a stair or a down escalator; nobody rises out of
   * the head of an escalator that is carrying people the other way.
   */
  up: boolean
  down: boolean
}

export interface PlatformStances {
  /** Somewhere to wait, in world coordinates. */
  stances: Spot[]
  /** The doorway each of those is waiting at, parallel to `stances`. */
  berth: number[]
  /** The deck, which is what everyone on the platform is standing on. */
  deckY: number
  gates: Gate[]
}

/** How far back from the platform edge the front row waits. */
const EDGE_STANDOFF = 1.35

/** And how much further back the row behind it stands. */
const ROW_PITCH = 0.85

/** How far to either side of a doorway people stand, leaving the middle clear. */
const QUEUE_ASIDE = 0.8
const QUEUE_SPLAY = 0.22

/** Seat pitch along a platform bench. */
const BENCH_SEAT_PITCH = 0.6

/** How far short of the lip of a flight someone stepping off it stands. */
const GATE_STANDOFF = 0.95

/** And how far out over the opening they are while still on the way up. */
const GATE_REACH = 1.2

/** How far short of the nearest flight's opening the clear route runs. */
const GATE_CLEARANCE = 1

/** Is there room for a person here, clear of everything bolted to the deck? */
function clearOf(obstacles: readonly WalkObstacle[], x: number, z: number): boolean {
  for (const obstacle of obstacles) {
    if (
      x + PERSON_RADIUS > obstacle.minX &&
      x - PERSON_RADIUS < obstacle.maxX &&
      z + PERSON_RADIUS > obstacle.minZ &&
      z - PERSON_RADIUS < obstacle.maxZ
    ) {
      return false
    }
  }
  return true
}

/**
 * A platform as places for people to wait (PLAN.md §8, §18).
 *
 * Where they wait is decided by where the doors will be: a train stops with
 * its centre on the station centre, so the doorways land at known points
 * along the deck and the crowd gathers to either side of each of them,
 * leaving the middle of the doorway clear for the people coming off. That is
 * how a Metro platform is actually used, and it is what makes the boarding
 * read as boarding rather than as a drift towards the train.
 *
 * `doors` are the doorway offsets of the stock that works the road, and `x`
 * is the station's chainage — the stances come back in world coordinates,
 * ready to stand in.
 */
export function platformStances(
  platform: PlatformConfig,
  track: TrackConfig,
  x: number,
  doors: readonly DoorBerth[],
): PlatformStances {
  const { edgeZ, sideSign, deckY } = platformLayout(platform, track)
  const fittings = platformFittings(platform, track)
  const obstacles = fittings.obstacles

  const stances: Spot[] = []
  const berth: number[] = []

  /** Everyone on a platform faces the track they are waiting for. */
  const facingTrack = sideSign === 1 ? Math.PI : 0
  const halfLength = platform.length / 2

  doors.forEach((door, index) => {
    for (const aside of [-1, 1] as const) {
      for (const row of [0, 1] as const) {
        const localX = door.x + aside * (QUEUE_ASIDE + row * QUEUE_SPLAY)
        const z = edgeZ + sideSign * (EDGE_STANDOFF + row * ROW_PITCH)

        // A doorway at the very end of a long train can overhang a short
        // platform, and a name board stands in the middle of the waiting area.
        if (Math.abs(localX) > halfLength - PERSON_RADIUS) continue
        if (!clearOf(obstacles, localX, z)) continue

        stances.push({ x: x + localX, z, yaw: facingTrack, seated: false, seatY: 0 })
        berth.push(index)
      }
    }
  })

  // The benches are places to wait too, and a platform where nobody ever sits
  // down reads as a platform nobody is really waiting on. They are taken from
  // the fittings rather than measured again, so a bench that moves takes the
  // people sat on it with it.
  const seatOffsets = spread(-BENCH_LENGTH / 2, BENCH_LENGTH / 2, BENCH_SEAT_PITCH, 0.32)

  for (const [benchX, , benchZ] of fittings.benchSeats) {
    for (const offset of seatOffsets) {
      const localX = benchX + offset
      stances.push({
        x: x + localX,
        z: benchZ,
        yaw: facingTrack,
        seated: true,
        seatY: BENCH_SEAT_Y,
      })
      berth.push(nearestDoorX(doors, localX))
    }
  }

  const layouts = accessLayouts(platform, track)
  const nearestOpening = Math.min(
    ...layouts.map((layout) => Math.abs(layout.centerZ - edgeZ) - layout.halfWidth),
  )
  const clearZ = edgeZ + sideSign * (nearestOpening - GATE_CLEARANCE)

  const gates = layouts.map((layout) => ({
    x: x + layout.headX - layout.descent * GATE_STANDOFF,
    z: layout.centerZ,
    fromX: x + layout.headX + layout.descent * GATE_REACH,
    fromZ: layout.centerZ,
    clearZ,
    up: layout.travel !== Travel.DOWN,
    down: layout.travel !== Travel.UP,
  }))

  return { stances, berth, deckY, gates }
}

/** The doorway nearest a point along the platform. */
function nearestDoorX(doors: readonly DoorBerth[], x: number): number {
  let best = 0
  let nearest = Number.POSITIVE_INFINITY

  doors.forEach((door, index) => {
    const distance = Math.abs(door.x - x)
    if (distance < nearest) {
      nearest = distance
      best = index
    }
  })

  return best
}

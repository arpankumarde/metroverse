import type { Vec3 } from '../components/InstancedParts'
import type { PlatformConfig, TrackConfig } from '../data/types'
import type { WalkObstacle } from '../systems/walk'
import { platformLayout } from './geometry'

/**
 * Everything bolted to a platform deck, as placements rather than meshes.
 *
 * Kept apart from the components that draw it because the walking system
 * needs exactly the same list: a bench the player can walk through is a bench
 * in the wrong place. `Furniture`/`Signage` render from this, `walkable`
 * collides against it, and neither can drift from the other (PLAN.md §12, §33).
 */

/** Bench: a slatted stainless seat with a low back, facing the track. */
export const BENCH_SPACING = 22
export const BENCH_LENGTH = 1.9
export const BENCH_SEAT: Vec3 = [BENCH_LENGTH, 0.07, 0.46]
export const BENCH_SEAT_Y = 0.44
export const BENCH_BACK: Vec3 = [BENCH_LENGTH, 0.4, 0.06]
export const BENCH_BACK_Y = 0.72
export const BENCH_BACK_OFFSET = 0.23
export const BENCH_LEG: Vec3 = [0.07, BENCH_SEAT_Y, 0.44]
const BENCH_LEG_OFFSET = 0.78
/** How far in from the platform's outer edge the bench row sits. */
const BENCH_SETBACK = 1.7

export const BIN_SPACING = 44
export const BIN_RADIUS = 0.24
export const BIN_HEIGHT = 0.82
const BIN_SETBACK = 0.85

/** Outer edge: a low concrete upstand carrying a painted steel railing. */
export const UPSTAND_HEIGHT = 0.34
export const UPSTAND_THICKNESS = 0.22
export const RAIL_HEIGHT_ABOVE_DECK = 1.12
export const RAIL_SECTION = 0.07
export const RAIL_POST_SPACING = 2.4
export const RAIL_POST_SECTION = 0.05

/** Station name boards on posts, facing the track (PLAN.md §8). */
export const NAME_BOARD: Vec3 = [2.4, 0.58, 0.07]
export const NAME_BOARD_CENTER_Y = 2.95
const NAME_BOARD_SETBACK = 1.6
const NAME_BOARD_SPACING = 0.2
const NAME_BOARD_COUNT = 5
export const NAME_POST_OFFSET = 0.95
export const NAME_POST_RADIUS = 0.045

export interface PlatformFittings {
  /** Deck height, repeated here so callers need not re-derive it. */
  deckY: number
  benchSeats: Vec3[]
  benchBacks: Vec3[]
  benchLegs: Vec3[]
  bins: Vec3[]
  railPosts: Vec3[]
  railPostHeight: number
  /** Z of the upstand and railing running along the outer edge. */
  upstandZ: number
  /** X of each station name board; they share one Z. */
  nameBoardX: number[]
  nameBoardZ: number
  /** Footprints the player cannot walk into. */
  obstacles: WalkObstacle[]
}

/** Evenly spaced X positions over a length, inset from both ends. */
export function spacedX(length: number, spacing: number): number[] {
  const usable = length - spacing
  const count = Math.max(1, Math.floor(usable / spacing))
  const pitch = usable / count
  return Array.from({ length: count + 1 }, (_, i) => -usable / 2 + i * pitch)
}

function footprint(
  id: string,
  x: number,
  z: number,
  halfX: number,
  halfZ: number,
): WalkObstacle {
  return { id, minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ }
}

export function platformFittings(platform: PlatformConfig, track: TrackConfig): PlatformFittings {
  const { edgeZ, sideSign, deckY } = platformLayout(platform, track)

  const outerZ = edgeZ + sideSign * platform.width
  const benchZ = outerZ - sideSign * BENCH_SETBACK
  const binZ = outerZ - sideSign * BIN_SETBACK
  const upstandZ = outerZ - sideSign * (UPSTAND_THICKNESS / 2)
  const nameBoardZ = edgeZ + sideSign * NAME_BOARD_SETBACK

  const benchX = spacedX(platform.length, BENCH_SPACING)
  const binX = spacedX(platform.length, BIN_SPACING)
  const postX = spacedX(platform.length, RAIL_POST_SPACING)
  const railPostHeight = RAIL_HEIGHT_ABOVE_DECK - UPSTAND_HEIGHT

  const nameBoardX = Array.from(
    { length: NAME_BOARD_COUNT },
    (_, i) => platform.length * NAME_BOARD_SPACING * (i - (NAME_BOARD_COUNT - 1) / 2),
  )

  // The bench body spans its seat and its back; one footprint covers both.
  const benchHalfZ = BENCH_SEAT[2] / 2 + BENCH_BACK_OFFSET / 2
  const benchFootprintZ = benchZ + sideSign * (BENCH_BACK_OFFSET / 2)

  const obstacles: WalkObstacle[] = [
    ...benchX.map((x, i) =>
      footprint(`${platform.id}-bench-${i}`, x, benchFootprintZ, BENCH_LENGTH / 2, benchHalfZ),
    ),
    ...binX.map((x, i) => footprint(`${platform.id}-bin-${i}`, x, binZ, BIN_RADIUS, BIN_RADIUS)),
    ...nameBoardX.flatMap((x, i) =>
      [NAME_POST_OFFSET, -NAME_POST_OFFSET].map((offset, j) =>
        footprint(
          `${platform.id}-name-post-${i}-${j}`,
          x + offset,
          nameBoardZ,
          NAME_POST_RADIUS,
          NAME_POST_RADIUS,
        ),
      ),
    ),
    footprint(
      `${platform.id}-upstand`,
      0,
      upstandZ,
      platform.length / 2,
      UPSTAND_THICKNESS / 2,
    ),
  ]

  return {
    deckY,
    benchSeats: benchX.map((x) => [x, deckY + BENCH_SEAT_Y, benchZ]),
    benchBacks: benchX.map((x) => [x, deckY + BENCH_BACK_Y, benchZ + sideSign * BENCH_BACK_OFFSET]),
    benchLegs: benchX.flatMap((x) =>
      [BENCH_LEG_OFFSET, -BENCH_LEG_OFFSET].map(
        (offset) => [x + offset, deckY + BENCH_SEAT_Y / 2, benchZ] as Vec3,
      ),
    ),
    bins: binX.map((x) => [x, deckY + BIN_HEIGHT / 2, binZ]),
    railPosts: postX.map((x) => [
      x,
      deckY + (UPSTAND_HEIGHT + RAIL_HEIGHT_ABOVE_DECK) / 2,
      upstandZ,
    ]),
    railPostHeight,
    upstandZ,
    nameBoardX,
    nameBoardZ,
    obstacles,
  }
}

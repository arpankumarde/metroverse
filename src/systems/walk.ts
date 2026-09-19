/**
 * Where the player may stand, and how one step resolves against it (PLAN.md §12).
 *
 * The world is described in positive space: a walkable area is a rectangle of
 * floor in the XZ plane at a fixed height, and the player may be anywhere in
 * the union of them. Obstacles punch holes back out for the things that stand
 * on a floor — columns, benches, ticket gates. Both are plain data, so this
 * never learns what a station is; `stations/walkable.ts` derives the volume
 * from the same config the platforms are drawn from.
 *
 * A floor may also be moving. Rectangles carrying a `frame` are measured from
 * that frame's origin rather than from the world, which is how the inside of
 * a train is walkable while the train runs: the saloon's rectangles never
 * change, the frame under them does (PLAN.md §5).
 *
 * And it need not be level or single-storey. A rectangle can carry a `slope`,
 * which is how a staircase or an escalator is walkable: the floor under the
 * player falls away along X, smoothly or a tread at a time. A rectangle can
 * carry a `belt` too, which is an escalator moving whoever stands on it.
 *
 * Because floors can now be stacked — a flight of stairs runs under the deck
 * it started from — the walk is told what height the player is standing at,
 * and only counts floors within a step of it. That is what keeps the deck
 * overhead from being mistaken for the floor underfoot, and it is also what
 * makes the edge of a stairwell an edge rather than a lift.
 */

/**
 * A moving floor. One per train: the carriage the player can board, ride and
 * step off again.
 */
export interface WalkFrame {
  /**
   * World position of the frame's origin. Written every frame by its owner.
   * The height matters as much as the other two: a train on a ramp into a
   * tunnel takes its floor — and anybody standing on it — down with it.
   */
  x: number
  y: number
  z: number
  /** How fast the frame is moving along world +X, and how fast that changes. */
  velocity: number
  acceleration: number
  /** Written by the player: are they standing on this frame's floor? */
  carrying: boolean
  /**
   * Switched off while the frame is out of reach — a train standing by out of
   * sight, or one too far down the line to walk to. Its floor stops counting,
   * which keeps the cost of the walk test to the trains actually at hand
   * rather than every train on the line (PLAN.md §28).
   */
  inactive: boolean
}

/**
 * A floor that falls away along X: an escalator, or a flight of stairs.
 *
 * It is measured in the same coordinates as the rectangle it belongs to, and
 * `floorY` on that rectangle is the height at the top of it, where the fall
 * begins.
 */
export interface WalkSlope {
  /** Where the fall begins: the head of the flight, at full `floorY`. */
  fromX: number
  /** +1 if the floor falls towards +X, -1 if towards -X. */
  descent: 1 | -1
  /** Metres of fall per metre along X. */
  gradient: number
  /** Where the fall ends, and the floor stops however far along it is. */
  bottomY: number
  /**
   * Set on a staircase: the going of one tread, in metres along X. The floor
   * then falls in whole treads rather than smoothly, and the first tread is
   * already a riser below the head.
   */
  tread?: number
}

export interface WalkArea {
  id: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /**
   * Height of the floor surface, i.e. what the player's feet rest on —
   * measured from the frame's origin where there is one, and from the world
   * where there is not. For a sloped floor this is the height at its top.
   */
  floorY: number
  /** Frame the rectangle is measured in. Absent means world-fixed. */
  frame?: WalkFrame
  /** Switched on and off at runtime: a doorway whose doors are shut. */
  closed?: boolean
  /** Present on a stair or an escalator: the floor is not level. */
  slope?: WalkSlope
  /**
   * A floor that is itself moving, in metres per second along world X and Z.
   * Whoever is standing on it is carried along at that velocity on top of
   * whatever walking they do. This is an escalator.
   */
  belt?: { x: number; z: number }
  /** How much of full walking speed is possible here; stairs are not run up. */
  pace?: number
}

export interface WalkObstacle {
  id: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  frame?: WalkFrame
  /**
   * The heights it occupies, in world Y. Absent means it is in the way at
   * every height, which is right for a bench and wrong for a pier that only
   * a person on the floor below has to walk round: the platform above it is
   * clear.
   */
  bottomY?: number
  topY?: number
}

export interface WalkVolume {
  areas: WalkArea[]
  obstacles: WalkObstacle[]
}

export interface WalkStep {
  x: number
  z: number
  /** The area the player ended up standing on, or null if there is none. */
  area: WalkArea | null
}

/** Directions sampled around the body. Eight is plenty at walking speed. */
const RIM: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
]

/** How tall a person is, for working out what is in their way. */
const BODY_HEIGHT = 1.8

/** How far out to look for solid floor when it has gone from underfoot. */
const RESCUE_STEPS: readonly number[] = [0.12, 0.25, 0.45, 0.7]

/**
 * The largest step, up or down, between two floors that still counts as one
 * floor to walk across. A riser is 0.165 m and a saloon sits level with its
 * platform, so this is generous; a stairwell is metres deep, so it is nowhere
 * near generous enough to let anyone fall down one.
 */
export const STEP_TOLERANCE = 0.5

/** Where a floor actually is at world X, once its frame and slope are counted. */
export function floorHeight(area: WalkArea, x = 0): number {
  const frame = area.frame
  const slope = area.slope
  const lift = frame ? frame.y : 0
  if (!slope) return area.floorY + lift

  const along = Math.max(0, ((frame ? x - frame.x : x) - slope.fromX) * slope.descent)
  const fall = slope.tread
    ? (Math.floor(along / slope.tread) + 1) * slope.tread * slope.gradient
    : along * slope.gradient

  return Math.max(area.floorY - fall, slope.bottomY) + lift
}

/** The union of several volumes, as one volume. */
export function mergeVolumes(...volumes: readonly WalkVolume[]): WalkVolume {
  return {
    areas: volumes.flatMap((volume) => volume.areas),
    obstacles: volumes.flatMap((volume) => volume.obstacles),
  }
}

/**
 * The floor at a point, of all those stacked over it.
 *
 * With a `level` — the height the player's feet are at — it is the floor
 * nearest that height, and only if it is within `tolerance` of it. Without one
 * (a player being placed, who has no height yet) it is the highest floor, as
 * if they had dropped on to the point from above.
 */
function areaUnder(
  volume: WalkVolume,
  x: number,
  z: number,
  level: number | null,
  tolerance: number,
): WalkArea | null {
  let found: WalkArea | null = null
  let foundGap = Number.POSITIVE_INFINITY

  for (const area of volume.areas) {
    if (area.closed) continue
    const frame = area.frame
    if (frame?.inactive) continue
    const localX = frame ? x - frame.x : x
    const localZ = frame ? z - frame.z : z
    if (
      localX < area.minX ||
      localX > area.maxX ||
      localZ < area.minZ ||
      localZ > area.maxZ
    ) {
      continue
    }

    const height = floorHeight(area, x)
    const gap = level === null ? -height : Math.abs(height - level)
    if (level !== null && gap > tolerance) continue

    if (gap < foundGap) {
      found = area
      foundGap = gap
    }
  }

  return found
}

/**
 * The area the player is standing on at (x, z), or null if their body does
 * not fit on the floor there.
 *
 * The body is a circle of `radius`, and every point around its rim has to be
 * over some area — not necessarily the same one. Testing the union rather
 * than a single rectangle is what lets a deck that has been cut into pieces
 * around a stairwell still walk as one continuous floor: at a seam between
 * two pieces the rim straddles both, and nothing catches. The same is what
 * carries the player over the gap between a platform and a berthed train.
 *
 * `level` is the height the player is standing at, if they are already
 * somewhere; see `areaUnder`.
 */
export function areaAt(
  volume: WalkVolume,
  x: number,
  z: number,
  radius: number,
  level: number | null = null,
  tolerance: number = STEP_TOLERANCE,
): WalkArea | null {
  const under = areaUnder(volume, x, z, level, tolerance)
  if (!under) return null

  for (const [dx, dz] of RIM) {
    if (!areaUnder(volume, x + dx * radius, z + dz * radius, level, tolerance)) return null
  }

  return under
}

function hitsObstacle(
  volume: WalkVolume,
  x: number,
  z: number,
  radius: number,
  level: number | null,
): boolean {
  for (const obstacle of volume.obstacles) {
    const frame = obstacle.frame
    if (frame?.inactive) continue

    // A body standing above or below the obstacle's own height range has
    // nothing to walk round. With no level to go on, assume the worst.
    if (level !== null) {
      if (obstacle.topY !== undefined && level >= obstacle.topY) continue
      if (obstacle.bottomY !== undefined && level + BODY_HEIGHT <= obstacle.bottomY) continue
    }

    const localX = frame ? x - frame.x : x
    const localZ = frame ? z - frame.z : z
    if (
      localX + radius > obstacle.minX &&
      localX - radius < obstacle.maxX &&
      localZ + radius > obstacle.minZ &&
      localZ - radius < obstacle.maxZ
    ) {
      return true
    }
  }
  return false
}

function standableAt(
  volume: WalkVolume,
  x: number,
  z: number,
  radius: number,
  level: number | null,
  tolerance: number,
): WalkArea | null {
  const area = areaAt(volume, x, z, radius, level, tolerance)
  if (!area || hitsObstacle(volume, x, z, radius, level)) return null
  return area
}

/**
 * The nearest place the player could be standing instead.
 *
 * Only ever needed when the floor is taken away from under them rather than
 * walked off: standing in a doorway as the doors shut leaves them on a
 * rectangle that has just been switched off, and they would otherwise be
 * frozen there. Stepping them inside is both the fix and what would really
 * happen.
 */
function rescue(
  volume: WalkVolume,
  x: number,
  z: number,
  radius: number,
  level: number | null,
  tolerance: number,
): WalkStep {
  for (const distance of RESCUE_STEPS) {
    for (const [dx, dz] of RIM) {
      const toX = x + dx * distance
      const toZ = z + dz * distance
      const area = standableAt(volume, toX, toZ, radius, level, tolerance)
      if (area) return { x: toX, z: toZ, area }
    }
  }
  return { x, z, area: null }
}

/**
 * Move from one point to another, stopping at whatever is in the way.
 *
 * A blocked step retries each axis on its own before giving up, so walking
 * into a wall at an angle slides along it instead of sticking.
 *
 * `level` is the height the player's feet are at. If nothing within a step of
 * that can be found even by rescue, the last resort is to stand them on
 * whichever floor is nearest, however far off, rather than leave them frozen
 * in mid-air over floors that are all a storey away.
 */
export function resolveWalk(
  volume: WalkVolume,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number,
  level: number | null = null,
): WalkStep {
  const near = STEP_TOLERANCE

  const direct = standableAt(volume, toX, toZ, radius, level, near)
  if (direct) return { x: toX, z: toZ, area: direct }

  const alongX = standableAt(volume, toX, fromZ, radius, level, near)
  if (alongX) return { x: toX, z: fromZ, area: alongX }

  const alongZ = standableAt(volume, fromX, toZ, radius, level, near)
  if (alongZ) return { x: fromX, z: toZ, area: alongZ }

  const standing = standableAt(volume, fromX, fromZ, radius, level, near)
  if (standing) return { x: fromX, z: fromZ, area: standing }

  const rescued = rescue(volume, fromX, fromZ, radius, level, near)
  if (rescued.area || level === null) return rescued

  const anywhere = Number.POSITIVE_INFINITY
  const settled = standableAt(volume, fromX, fromZ, radius, level, anywhere)
  if (settled) return { x: fromX, z: fromZ, area: settled }

  return rescue(volume, fromX, fromZ, radius, level, anywhere)
}

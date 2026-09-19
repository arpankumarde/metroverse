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

export interface WalkArea {
  id: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  /**
   * Height of the floor surface, i.e. what the player's feet rest on —
   * measured from the frame's origin where there is one, and from the world
   * where there is not.
   */
  floorY: number
  /** Frame the rectangle is measured in. Absent means world-fixed. */
  frame?: WalkFrame
  /** Switched on and off at runtime: a doorway whose doors are shut. */
  closed?: boolean
}

export interface WalkObstacle {
  id: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  frame?: WalkFrame
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

/** How far out to look for solid floor when it has gone from underfoot. */
const RESCUE_STEPS: readonly number[] = [0.12, 0.25, 0.45, 0.7]

/** Where a floor actually is, once its frame has been taken into account. */
export function floorHeight(area: WalkArea): number {
  return area.frame ? area.floorY + area.frame.y : area.floorY
}

/** The union of several volumes, as one volume. */
export function mergeVolumes(...volumes: readonly WalkVolume[]): WalkVolume {
  return {
    areas: volumes.flatMap((volume) => volume.areas),
    obstacles: volumes.flatMap((volume) => volume.obstacles),
  }
}

function areaUnder(volume: WalkVolume, x: number, z: number): WalkArea | null {
  for (const area of volume.areas) {
    if (area.closed) continue
    const frame = area.frame
    if (frame?.inactive) continue
    const localX = frame ? x - frame.x : x
    const localZ = frame ? z - frame.z : z
    if (
      localX >= area.minX &&
      localX <= area.maxX &&
      localZ >= area.minZ &&
      localZ <= area.maxZ
    ) {
      return area
    }
  }
  return null
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
 */
export function areaAt(volume: WalkVolume, x: number, z: number, radius: number): WalkArea | null {
  const under = areaUnder(volume, x, z)
  if (!under) return null

  for (const [dx, dz] of RIM) {
    if (!areaUnder(volume, x + dx * radius, z + dz * radius)) return null
  }

  return under
}

function hitsObstacle(volume: WalkVolume, x: number, z: number, radius: number): boolean {
  for (const obstacle of volume.obstacles) {
    const frame = obstacle.frame
    if (frame?.inactive) continue
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

function standableAt(volume: WalkVolume, x: number, z: number, radius: number): WalkArea | null {
  const area = areaAt(volume, x, z, radius)
  if (!area || hitsObstacle(volume, x, z, radius)) return null
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
function rescue(volume: WalkVolume, x: number, z: number, radius: number): WalkStep {
  for (const distance of RESCUE_STEPS) {
    for (const [dx, dz] of RIM) {
      const toX = x + dx * distance
      const toZ = z + dz * distance
      const area = standableAt(volume, toX, toZ, radius)
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
 */
export function resolveWalk(
  volume: WalkVolume,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number,
): WalkStep {
  const direct = standableAt(volume, toX, toZ, radius)
  if (direct) return { x: toX, z: toZ, area: direct }

  const alongX = standableAt(volume, toX, fromZ, radius)
  if (alongX) return { x: toX, z: fromZ, area: alongX }

  const alongZ = standableAt(volume, fromX, toZ, radius)
  if (alongZ) return { x: fromX, z: toZ, area: alongZ }

  const standing = standableAt(volume, fromX, fromZ, radius)
  if (standing) return { x: fromX, z: fromZ, area: standing }

  return rescue(volume, fromX, fromZ, radius)
}

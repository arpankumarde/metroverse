import type { Vec3 } from '../components/InstancedParts'

/**
 * Rectangle arithmetic for decks with holes in them.
 *
 * A platform deck is a rectangle until a stair or escalator opening is cut
 * through it, at which point both the slab that is drawn and the floor the
 * player may stand on become the same set of smaller rectangles. Doing it
 * here once means the two can never disagree about where the hole is.
 */

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface Box {
  position: Vec3
  size: Vec3
}

/** Slop below which two edges are treated as the same edge. */
const EPSILON = 1e-6

export function rectFromCenter(x: number, z: number, sizeX: number, sizeZ: number): Rect {
  return {
    minX: x - sizeX / 2,
    maxX: x + sizeX / 2,
    minZ: z - sizeZ / 2,
    maxZ: z + sizeZ / 2,
  }
}

/** A rect between two Z values, either order — handy for mirrored platforms. */
export function rectBetweenZ(minX: number, maxX: number, a: number, b: number): Rect {
  return { minX, maxX, minZ: Math.min(a, b), maxZ: Math.max(a, b) }
}

/** The box that fills a rect between two heights. */
export function boxOver(rect: Rect, bottomY: number, topY: number): Box {
  return {
    position: [(rect.minX + rect.maxX) / 2, (bottomY + topY) / 2, (rect.minZ + rect.maxZ) / 2],
    size: [rect.maxX - rect.minX, topY - bottomY, rect.maxZ - rect.minZ],
  }
}

/**
 * `outer` with `holes` punched out of it, as covering rectangles that tile it
 * exactly: no overlaps, no gaps, and shared edges are bit-identical so the
 * walking system sees one continuous floor rather than a row of islands.
 *
 * Cut into bands along X at every hole edge, then split each band along Z by
 * whichever holes span the whole band. Holes that overlap in Z merge.
 */
export function rectsAround(outer: Rect, holes: readonly Rect[]): Rect[] {
  const clipped = holes
    .map((hole) => ({
      minX: Math.max(hole.minX, outer.minX),
      maxX: Math.min(hole.maxX, outer.maxX),
      minZ: Math.max(hole.minZ, outer.minZ),
      maxZ: Math.min(hole.maxZ, outer.maxZ),
    }))
    .filter((hole) => hole.maxX - hole.minX > EPSILON && hole.maxZ - hole.minZ > EPSILON)

  if (clipped.length === 0) return [outer]

  const cuts = [outer.minX, outer.maxX, ...clipped.flatMap((hole) => [hole.minX, hole.maxX])].sort(
    (a, b) => a - b,
  )

  const rects: Rect[] = []

  for (let i = 0; i < cuts.length - 1; i++) {
    const minX = cuts[i]
    const maxX = cuts[i + 1]
    if (maxX - minX <= EPSILON) continue

    const spanning = clipped
      .filter((hole) => hole.minX <= minX + EPSILON && hole.maxX >= maxX - EPSILON)
      .sort((a, b) => a.minZ - b.minZ)

    let z = outer.minZ
    for (const hole of spanning) {
      if (hole.minZ - z > EPSILON) rects.push({ minX, maxX, minZ: z, maxZ: hole.minZ })
      z = Math.max(z, hole.maxZ)
    }
    if (outer.maxZ - z > EPSILON) rects.push({ minX, maxX, minZ: z, maxZ: outer.maxZ })
  }

  return rects
}

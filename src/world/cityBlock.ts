import type { Panel, Vec3 } from '../components/InstancedParts'
import { districtAt, landmarksBetween, type District, type Landmark } from '../data/city'
import { GROUND_Y } from './Daylight'

/**
 * The cross-section of the road the metro was built down the middle of, and
 * the rule for filling in the frontage either side of it (PLAN.md §19).
 *
 * Delhi built the elevated Blue Line over an existing arterial, so the shape
 * of the world under the viaduct is fixed and the same all the way along:
 * a planted median with the piers marching down it, a carriageway each side,
 * a footpath with trees and street lights, and then the buildings. All that
 * changes from one stretch to the next is how tall and how dense the
 * frontage is, which is what a `District` says.
 *
 * Everything comes out of here as plain boxes so a whole block can be drawn
 * as one instanced mesh. Nothing in here is a React component and nothing
 * touches three.js (PLAN.md §33).
 */

/** Half width of the median the viaduct stands in. */
export const MEDIAN_HALF = 13

/** Kerb line, outer edge of the carriageway, and back of the footpath. */
export const ROAD_INNER = 14.6
export const ROAD_OUTER = 28
export const FOOTPATH_OUTER = 31.6

/** Where a building plot starts, measured from the line's centreline. */
export const PLOT_Z = 32

/** Where the trees and the street lights stand. */
const TREE_Z = 29.7
const LAMP_Z = 13.6

/** Heights above street level. */
const MEDIAN_TOP = 0.36
const FOOTPATH_TOP = 0.18
const ROAD_TOP = 0.05

const STOREY = 3.3

/** How much of the corridor one block covers, in metres. */
export const BLOCK_LENGTH = 180

const ASPHALT = '#3e3f42'
const MEDIAN_EARTH = '#6d6453'
const KERB = '#b9b3a6'
const FOOTPATH = '#8f8a7e'
const LANE_PAINT = '#d8d4c6'

/** Glazing on the ordinary frontage: ribbon windows, floor by floor. */
const GLASS = ['#3d4c5a', '#44566a', '#35424e', '#4a5d6d'] as const

/** Water tanks, the one thing on every roof in Delhi. */
const TANK_COLORS = ['#1d1f22', '#26497e', '#2b2d30'] as const

/** Hoardings, which are on every other roof. */
const HOARDING_COLORS = ['#c0392b', '#1f6f8b', '#e0a80d', '#2e7d4f', '#8e44ad'] as const

/** Foliage, from dusty roadside neem to watered green. */
const FOLIAGE = ['#4a6033', '#57703c', '#3f5530', '#62794a', '#4e6637'] as const

const TRUNK_COLOR = '#4b4034'

export interface Tree {
  position: Vec3
  size: Vec3
  color: string
}

/** Everything in one block, sorted by the material it is drawn with. */
export interface BlockContents {
  /** Walls, kerbs, carriageway, parapets, poles: one matte draw call. */
  solid: Panel[]
  /** Ribbon windows, drawn shinier than the walls they sit in. */
  glazing: Panel[]
  /** Lamp heads, which are emissive rather than lit. */
  lamps: Panel[]
  trunks: Tree[]
  canopies: Tree[]
}

/**
 * A small deterministic generator, seeded per block.
 *
 * A block has to come out identical every time it is built, because it is
 * built and thrown away again every time the player walks past it. Anything
 * drawn from `Math.random` would rebuild the street differently each time.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, from: readonly T[]): T {
  const chosen = from[Math.floor(random() * from.length)]
  if (chosen === undefined) throw new Error('Cannot pick from an empty list')
  return chosen
}

function between(random: () => number, low: number, high: number): number {
  return low + random() * (high - low)
}

/** The footprint a landmark takes out of the frontage it stands in. */
function footprint(landmark: Landmark): { from: number; to: number; side: 1 | -1 } {
  return {
    from: landmark.x - landmark.width / 2 - 6,
    to: landmark.x + landmark.width / 2 + 6,
    side: landmark.side,
  }
}

interface Building {
  /** Along the line. */
  from: number
  width: number
  side: 1 | -1
  /** Back from the plot line. */
  setback: number
  depth: number
  height: number
  wall: string
}

/** Wall, floor bands, parapet, roof clutter: one ordinary frontage building. */
function raise(building: Building, random: () => number, into: BlockContents): void {
  const { from, width, side, setback, depth, height, wall } = building

  const centerX = from + width / 2
  const centerZ = side * (PLOT_Z + setback + depth / 2)
  const base = GROUND_Y

  into.solid.push({
    position: [centerX, base + height / 2, centerZ],
    size: [width, height, depth],
    color: wall,
  })

  // The parapet, which is what stops a roof reading as a sawn-off box.
  into.solid.push({
    position: [centerX, base + height + 0.35, centerZ],
    size: [width + 0.34, 0.7, depth + 0.34],
    color: wall,
  })

  const storeys = Math.max(1, Math.floor(height / STOREY))
  const glass = pick(random, GLASS)

  // Ribbon windows: one band per floor, wrapped right round the building, so
  // a whole tower's glazing is a handful of boxes rather than a grid of
  // hundreds of panes (PLAN.md §28).
  for (let storey = 0; storey < storeys; storey++) {
    const sill = base + storey * STOREY + 1.1
    if (sill + 1.5 > base + height - 0.4) break

    into.glazing.push({
      position: [centerX, sill + 0.75, centerZ],
      size: [width + 0.14, 1.5, depth + 0.14],
      color: glass,
    })
  }

  // Roof clutter. Water tanks are the most Delhi thing there is, and they are
  // what makes a skyline of boxes read as a skyline of buildings.
  const tanks = 1 + Math.floor(random() * 3)
  for (let tank = 0; tank < tanks; tank++) {
    const size = between(random, 1, 1.6)
    into.solid.push({
      position: [
        centerX + between(random, -width / 2 + 2, width / 2 - 2),
        base + height + 0.7 + size / 2,
        centerZ + between(random, -depth / 2 + 2, depth / 2 - 2),
      ],
      size: [size, size * 0.9, size],
      color: pick(random, TANK_COLORS),
    })
  }

  if (random() < 0.5) {
    into.solid.push({
      position: [
        centerX + between(random, -width / 4, width / 4),
        base + height + 1.9,
        centerZ,
      ],
      size: [3.4, 2.6, 3.4],
      color: wall,
    })
  }

  // A hoarding on the roof, facing the line, which is how Delhi advertises.
  if (height > 12 && random() < 0.35) {
    const boardWidth = Math.min(width * 0.8, 16)
    const boardZ = side * (PLOT_Z + setback - 0.4)

    into.solid.push({
      position: [centerX, base + height + 3.4, boardZ],
      size: [boardWidth, 4.2, 0.3],
      color: pick(random, HOARDING_COLORS),
    })

    for (const post of [-1, 1]) {
      into.solid.push({
        position: [centerX + post * (boardWidth / 2 - 0.6), base + height + 1.3, boardZ],
        size: [0.22, 3.2, 0.22],
        color: '#5b5f63',
      })
    }
  }

  // A compound wall where the building stands back from the pavement.
  if (setback > 2.5) {
    into.solid.push({
      position: [centerX, base + 1.1, side * (PLOT_Z + 0.2)],
      size: [width, 2.2, 0.32],
      color: '#b3a98f',
    })
  }
}

/** The road itself: median, carriageways, kerbs, footpaths, lane markings. */
function pave(from: number, to: number, into: BlockContents): void {
  const length = to - from
  const centerX = (from + to) / 2

  into.solid.push({
    position: [centerX, GROUND_Y + MEDIAN_TOP / 2, 0],
    size: [length, MEDIAN_TOP, MEDIAN_HALF * 2],
    color: MEDIAN_EARTH,
  })

  for (const side of [1, -1] as const) {
    const roadWidth = ROAD_OUTER - ROAD_INNER
    const roadZ = side * (ROAD_INNER + roadWidth / 2)

    into.solid.push({
      position: [centerX, GROUND_Y + ROAD_TOP / 2, roadZ],
      size: [length, ROAD_TOP, roadWidth],
      color: ASPHALT,
    })

    for (const edge of [ROAD_INNER, ROAD_OUTER]) {
      into.solid.push({
        position: [centerX, GROUND_Y + 0.17, side * edge],
        size: [length, 0.34, 0.34],
        color: KERB,
      })
    }

    const pathWidth = FOOTPATH_OUTER - ROAD_OUTER
    into.solid.push({
      position: [centerX, GROUND_Y + FOOTPATH_TOP / 2, side * (ROAD_OUTER + pathWidth / 2)],
      size: [length, FOOTPATH_TOP, pathWidth],
      color: FOOTPATH,
    })

    // Lane markings down the middle of each carriageway.
    const dashes = Math.floor(length / 9)
    for (let dash = 0; dash < dashes; dash++) {
      into.solid.push({
        position: [from + (dash + 0.5) * 9, GROUND_Y + ROAD_TOP + 0.01, roadZ],
        size: [3.2, 0.02, 0.16],
        color: LANE_PAINT,
      })
    }
  }
}

/** Street lights down both sides of the median, reaching out over the road. */
function light(from: number, to: number, into: BlockContents): void {
  const spacing = 34
  const count = Math.max(1, Math.round((to - from) / spacing))
  const pitch = (to - from) / count

  for (let i = 0; i < count; i++) {
    const x = from + (i + 0.5) * pitch

    for (const side of [1, -1] as const) {
      const poleZ = side * LAMP_Z
      const top = GROUND_Y + 8.6

      into.solid.push({
        position: [x, GROUND_Y + 4.3, poleZ],
        size: [0.24, 8.6, 0.24],
        color: '#6b6f73',
      })

      into.solid.push({
        position: [x, top, poleZ + side * 1.3],
        size: [0.18, 0.18, 2.6],
        color: '#6b6f73',
      })

      into.lamps.push({
        position: [x, top - 0.2, poleZ + side * 2.5],
        size: [0.7, 0.22, 0.42],
        color: '#ffe9bd',
      })
    }
  }
}

/** Roadside trees along both footpaths. */
function plant(
  from: number,
  to: number,
  district: District,
  random: () => number,
  blocked: readonly { from: number; to: number; side: 1 | -1 }[],
  into: BlockContents,
): void {
  const pitch = 100 / Math.max(1, district.trees)

  for (let x = from + pitch / 2; x < to; x += pitch) {
    for (const side of [1, -1] as const) {
      if (random() < 0.18) continue

      const at = x + between(random, -pitch / 4, pitch / 4)
      if (blocked.some((gap) => gap.side === side && at > gap.from && at < gap.to)) continue

      const trunk = between(random, 2.2, 3.6)
      const spread = between(random, 1.9, 3.4)
      const z = side * (TREE_Z + between(random, -0.6, 0.6))

      into.trunks.push({
        position: [at, GROUND_Y + FOOTPATH_TOP + trunk / 2, z],
        size: [1, trunk, 1],
        color: TRUNK_COLOR,
      })

      into.canopies.push({
        position: [at, GROUND_Y + FOOTPATH_TOP + trunk + spread * 0.55, z],
        size: [spread, spread * 0.85, spread],
        color: pick(random, FOLIAGE),
      })
    }
  }
}

/** A side road crossing under the line, with the frontage broken for it. */
function crossStreet(
  from: number,
  to: number,
  random: () => number,
): { from: number; to: number; side: 1 | -1 }[] {
  if (random() > 0.55) return []

  const at = between(random, from + 30, to - 30)
  const half = between(random, 8, 13)

  return [
    { from: at - half, to: at + half, side: 1 },
    { from: at - half, to: at + half, side: -1 },
  ]
}

/**
 * One block of city, built from its own index and nothing else.
 *
 * Named buildings are placed first and the procedural frontage fills in
 * around them, so a bank never ends up inside an anonymous office block.
 */
export function buildBlock(index: number, from: number, to: number): BlockContents {
  const random = seeded(index * 0x9e3779b1 + 17)
  const district = districtAt((from + to) / 2)

  const into: BlockContents = { solid: [], glazing: [], lamps: [], trunks: [], canopies: [] }

  const streets = crossStreet(from, to, random)
  const taken = [...landmarksBetween(from, to).map(footprint), ...streets]

  pave(from, to, into)
  light(from, to, into)

  for (const side of [1, -1] as const) {
    let cursor = from + between(random, 0, 10)

    while (cursor < to) {
      const width = between(random, 14, 38)

      // A building is never cut by a block boundary: a block has to be
      // complete on its own, because it is culled on its own.
      if (cursor + width > to) break

      const clash = taken.find(
        (gap) => gap.side === side && cursor < gap.to && cursor + width > gap.from,
      )
      if (clash) {
        cursor = clash.to + between(random, 2, 8)
        continue
      }

      if (random() < district.density) {
        const storeys = Math.round(between(random, district.minStoreys, district.maxStoreys))

        raise(
          {
            from: cursor,
            width,
            side,
            setback: between(random, 0, 7),
            depth: between(random, 18, 46),
            height: storeys * STOREY,
            wall: pick(random, district.palette),
          },
          random,
          into,
        )
      }

      cursor += width + between(random, 3, 11)
    }
  }

  // The side road. It stops at the median rather than crossing it, which is
  // how a side road meets a divided arterial: it tees in, and only the
  // flyovers and the big junctions get to cross.
  for (const street of streets.filter((gap) => gap.side === 1)) {
    const width = street.to - street.from
    const reach = 110

    for (const side of [1, -1] as const) {
      into.solid.push({
        position: [
          (street.from + street.to) / 2,
          GROUND_Y + 0.1,
          side * (ROAD_INNER + reach / 2),
        ],
        size: [width, 0.2, reach],
        color: ASPHALT,
      })
    }
  }

  plant(from, to, district, random, taken, into)

  return into
}

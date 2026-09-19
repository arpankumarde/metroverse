import { BufferAttribute, BufferGeometry } from 'three'
import type { RollingStockConfig } from '../data/types'
import { crownY, ledStripY, roofHalfWidth, shellTopAbs, trainLength } from './geometry'

/**
 * The curved parts of the outside of the train: the roof shoulder that runs
 * the length of every car, and the streamlined nose on each driving end with
 * its windscreen and its lamps (PLAN.md §22).
 *
 * Everything in here is one cross-section swept along the car. The section is
 * written once — a flat-bottomed skirt, vertical flanks, a domed roof — and
 * the shoulder is that section from the ceiling slab up, while the nose is
 * that same section scaled down along a profile until it runs out into a
 * blade. That is what makes the nose look grown out of the body rather than
 * bolted to it: at the root it *is* the body section, to the millimetre.
 *
 * All of it is built as indexed grids with smooth vertex normals, because the
 * whole point of the shape is that the light runs along it unbroken. Each
 * geometry is built once per stock and shared by every train on the line, so
 * a hundred cars cost one upload (PLAN.md §28).
 */

/** A point on the body cross-section, looking along the car. */
export interface Point2 {
  z: number
  y: number
}

/** Radius the body fairing turns under at the bottom of the section. */
const SKIRT_RADIUS = 0.3

/** How finely the section is drawn: corner arc, roof shoulder, whole ring. */
const CORNER_STEPS = 6
const SHOULDER_STEPS = 12
const SECTION_SEGMENTS = 52

/** Rings along the nose, from the car end to the tip. */
const NOSE_RINGS = 20

/**
 * How the nose narrows. The width is held most of the way and then let go
 * quickly, which is what gives a high-speed nose its duckbill rather than the
 * plain cone you get from tapering evenly.
 */
const TAPER_HOLD = 2.6
const TAPER_FALL = 2.2

/**
 * The windscreen: a patch of the nose surface itself, lifted a few
 * millimetres clear of it, running from just ahead of the cab door to most of
 * the way to the tip. Because it is the nose surface it is seamless — there
 * is no frame, no flat pane set into a curved body, nothing to catch the eye
 * as a join.
 *
 * Its lower edge is not a number: it is wherever the LED strip along the car
 * side is, so the strip runs the length of the train and the glass picks the
 * line up and carries it round the front.
 */
const GLASS_FROM = 0.14
const GLASS_TO = 0.62
const GLASS_PROUD = 0.014
const GLASS_U_STEPS = 14
const GLASS_P_STEPS = 24

/** Slim LED headlamp: a strip laid along each flank, low and well forward. */
const LAMP_FROM = 0.6
const LAMP_TO = 0.88
const LAMP_LOW = 0.212
const LAMP_HIGH = 0.248
const LAMP_PROUD = 0.012
const LAMP_U_STEPS = 8
const LAMP_P_STEPS = 4

/** Overall length over the noses, which is what a train actually occupies. */
export function overallLength(stock: RollingStockConfig): number {
  return trainLength(stock) + 2 * stock.nose.length
}

function quadratic(a: Point2, control: Point2, b: Point2, t: number): Point2 {
  const s = 1 - t
  return {
    z: s * s * a.z + 2 * s * t * control.z + t * t * b.z,
    y: s * s * a.y + 2 * s * t * control.y + t * t * b.y,
  }
}

/**
 * The +Z half of the body section, from the bottom centreline up to the
 * crown: the skirt turning under, the flank, and the roof domed over.
 *
 * The shoulder leaves the flank vertically and meets the roof flat, so the
 * curve is tangent to both and the body has no crease anywhere along it.
 */
function halfSection(stock: RollingStockConfig): Point2[] {
  const halfWidth = stock.carWidth / 2
  const crown = crownY(stock)
  const spring = shellTopAbs(stock)

  const points: Point2[] = [{ z: 0, y: stock.skirtY }]

  for (let i = 1; i <= CORNER_STEPS; i++) {
    const angle = (i / CORNER_STEPS) * (Math.PI / 2)
    points.push({
      z: halfWidth - SKIRT_RADIUS * (1 - Math.sin(angle)),
      y: stock.skirtY + SKIRT_RADIUS * (1 - Math.cos(angle)),
    })
  }

  const shoulder: Point2 = { z: halfWidth, y: spring }
  const control: Point2 = { z: halfWidth, y: crown }
  const roof: Point2 = { z: roofHalfWidth(stock), y: crown }

  points.push(shoulder)
  for (let i = 1; i <= SHOULDER_STEPS; i++) {
    points.push(quadratic(shoulder, control, roof, i / SHOULDER_STEPS))
  }
  points.push({ z: 0, y: crown })

  return points
}

/**
 * Reads the section by how far round it you have gone, 0 at the bottom
 * centreline through 0.5 at the crown and back to 1.
 *
 * Measuring by distance round rather than by index is what lets the
 * windscreen and the lamps be placed as "this far round the body" and come
 * out evenly spaced, however coarsely or finely the section itself is drawn.
 */
function sectionReader(stock: RollingStockConfig): (p: number) => Point2 {
  const half = halfSection(stock)
  const loop = [...half]
  for (let i = half.length - 2; i >= 1; i--) loop.push({ z: -half[i].z, y: half[i].y })

  const count = loop.length
  const run = new Float64Array(count + 1)
  for (let i = 0; i < count; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % count]
    run[i + 1] = run[i] + Math.hypot(b.z - a.z, b.y - a.y)
  }
  const perimeter = run[count]

  return (p) => {
    const along = (((p % 1) + 1) % 1) * perimeter

    let i = 0
    while (i < count - 1 && run[i + 1] < along) i++

    const a = loop[i]
    const b = loop[(i + 1) % count]
    const span = run[i + 1] - run[i]
    const t = span > 0 ? (along - run[i]) / span : 0

    return { z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t }
  }
}

/** How far round the section a given height on the flank is. */
function perimeterAtHeight(read: (p: number) => Point2, y: number): number {
  let low = 0
  let high = 0.5

  // The +Z half climbs steadily from the skirt to the crown, so the height
  // pins down one point on it and bisection finds it.
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2
    if (read(mid).y < y) low = mid
    else high = mid
  }
  return (low + high) / 2
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * The nose at `u` along its length: how much of the body's width is left,
 * and where its roof and its underside have got to.
 */
function noseProfile(stock: RollingStockConfig, u: number) {
  const { nose } = stock
  const tipScale = nose.tipHalfWidth / (stock.carWidth / 2)
  const taper = Math.pow(Math.max(0, 1 - Math.pow(u, TAPER_HOLD)), 1 / TAPER_FALL)
  const drop = smoothstep(u)

  return {
    widthScale: tipScale + (1 - tipScale) * taper,
    top: crownY(stock) + (nose.tipTopY - crownY(stock)) * drop,
    bottom: stock.skirtY + (nose.tipBottomY - stock.skirtY) * drop,
  }
}

/** A point on the nose surface: `u` along it, `p` round it. */
function nosePoint(
  stock: RollingStockConfig,
  read: (p: number) => Point2,
  u: number,
  p: number,
): Point2 {
  const section = read(p)
  const { widthScale, top, bottom } = noseProfile(stock, u)
  const height = (section.y - stock.skirtY) / (crownY(stock) - stock.skirtY)

  return { z: section.z * widthScale, y: bottom + height * (top - bottom) }
}

/** The same point, lifted clear of the surface for glass or a lamp to sit on. */
function proudPoint(
  stock: RollingStockConfig,
  read: (p: number) => Point2,
  u: number,
  p: number,
  proud: number,
): Point2 {
  const here = nosePoint(stock, read, u, p)
  const before = nosePoint(stock, read, u, p - 0.002)
  const after = nosePoint(stock, read, u, p + 0.002)

  const tz = after.z - before.z
  const ty = after.y - before.y
  const length = Math.hypot(tz, ty) || 1

  // The section is drawn anticlockwise, so turning the tangent right points
  // out of the body.
  return { z: here.z + (ty / length) * proud, y: here.y - (tz / length) * proud }
}

/** One cross-section of a swept surface, at its own station along the car. */
interface Ring {
  x: number
  points: Point2[]
}

interface Mesh {
  positions: number[]
  indices: number[]
}

/**
 * Sweeps the rings into a surface, wound so the outside faces out.
 *
 * `closed` joins the last point of each ring back round to the first, which
 * is what makes a tube out of a section rather than a strip out of a patch.
 */
function sweep(mesh: Mesh, rings: Ring[], closed: boolean) {
  const cols = rings[0].points.length
  const base = mesh.positions.length / 3

  for (const ring of rings) {
    for (const point of ring.points) mesh.positions.push(ring.x, point.y, point.z)
  }

  const edges = closed ? cols : cols - 1

  for (let r = 0; r < rings.length - 1; r++) {
    for (let c = 0; c < edges; c++) {
      const next = (c + 1) % cols
      const a = base + r * cols + c
      const b = base + (r + 1) * cols + c
      const d = base + (r + 1) * cols + next
      const e = base + r * cols + next
      mesh.indices.push(a, b, d, a, d, e)
    }
  }
}

/** Closes off one end of a swept tube with a fan from its centre. */
function capRing(mesh: Mesh, ring: Ring, facing: 1 | -1) {
  const count = ring.points.length

  let y = 0
  let z = 0
  for (const point of ring.points) {
    y += point.y
    z += point.z
  }

  const centre = mesh.positions.length / 3
  mesh.positions.push(ring.x, y / count, z / count)

  const base = centre + 1
  for (const point of ring.points) mesh.positions.push(ring.x, point.y, point.z)

  for (let c = 0; c < count; c++) {
    const next = base + ((c + 1) % count)
    if (facing < 0) mesh.indices.push(centre, base + c, next)
    else mesh.indices.push(centre, next, base + c)
  }
}

function build(mesh: Mesh): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3))
  geometry.setIndex(mesh.indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * The roof shoulder of one car: the section from the top of the saloon
 * ceiling up over the crown, closed off underneath and at both ends.
 *
 * The corners where the curve meets the flat underside are drawn twice so
 * they stay crisp; everywhere else the normals are averaged, so the roof
 * reads as one continuous surface rather than a set of facets.
 */
function buildBodyShell(stock: RollingStockConfig): BufferGeometry {
  const halfWidth = stock.carWidth / 2
  const spring = shellTopAbs(stock)
  const half = halfSection(stock)
  const shoulder = half.filter((point) => point.y > spring)

  const points: Point2[] = [{ z: halfWidth, y: spring }, { z: halfWidth, y: spring }]
  for (const point of shoulder) points.push(point)
  for (let i = shoulder.length - 2; i >= 0; i--) {
    points.push({ z: -shoulder[i].z, y: shoulder[i].y })
  }
  points.push({ z: -halfWidth, y: spring }, { z: -halfWidth, y: spring })

  const halfCar = stock.carLength / 2
  const rings: Ring[] = [
    { x: -halfCar, points },
    { x: halfCar, points },
  ]

  const mesh: Mesh = { positions: [], indices: [] }
  sweep(mesh, rings, true)
  capRing(mesh, rings[0], -1)
  capRing(mesh, rings[1], 1)
  return build(mesh)
}

/** The nose fairing on one driving end, drawn from its root along its own +X. */
function buildNoseShell(stock: RollingStockConfig): BufferGeometry {
  const read = sectionReader(stock)
  const rings: Ring[] = []

  for (let r = 0; r <= NOSE_RINGS; r++) {
    const u = r / NOSE_RINGS
    const points: Point2[] = []

    for (let c = 0; c < SECTION_SEGMENTS; c++) {
      points.push(nosePoint(stock, read, u, c / SECTION_SEGMENTS))
    }
    rings.push({ x: u * stock.nose.length, points })
  }

  const mesh: Mesh = { positions: [], indices: [] }
  sweep(mesh, rings, true)
  capRing(mesh, rings[0], -1)
  capRing(mesh, rings[rings.length - 1], 1)
  return build(mesh)
}

/** A patch lifted off the nose surface: a run along it, a band round it. */
function buildPatch(
  stock: RollingStockConfig,
  read: (p: number) => Point2,
  bounds: { uFrom: number; uTo: number; pFrom: number; pTo: number },
  proud: number,
  steps: { u: number; p: number },
  mesh: Mesh,
) {
  const rings: Ring[] = []

  for (let r = 0; r <= steps.u; r++) {
    const u = bounds.uFrom + ((bounds.uTo - bounds.uFrom) * r) / steps.u
    const points: Point2[] = []

    for (let c = 0; c <= steps.p; c++) {
      const p = bounds.pFrom + ((bounds.pTo - bounds.pFrom) * c) / steps.p
      points.push(proudPoint(stock, read, u, p, proud))
    }
    rings.push({ x: u * stock.nose.length, points })
  }

  sweep(mesh, rings, false)
}

/** The windscreen, wrapped over the nose from one LED strip round to the other. */
function buildNoseGlass(stock: RollingStockConfig): BufferGeometry {
  const read = sectionReader(stock)
  const edge = perimeterAtHeight(read, ledStripY(stock))

  const mesh: Mesh = { positions: [], indices: [] }
  buildPatch(
    stock,
    read,
    { uFrom: GLASS_FROM, uTo: GLASS_TO, pFrom: edge, pTo: 1 - edge },
    GLASS_PROUD,
    { u: GLASS_U_STEPS, p: GLASS_P_STEPS },
    mesh,
  )
  return build(mesh)
}

/** The pair of lamp strips on one end, one down each flank. */
function buildNoseLamps(stock: RollingStockConfig): BufferGeometry {
  const read = sectionReader(stock)
  const mesh: Mesh = { positions: [], indices: [] }

  for (const flank of [
    { pFrom: LAMP_LOW, pTo: LAMP_HIGH },
    { pFrom: 1 - LAMP_HIGH, pTo: 1 - LAMP_LOW },
  ]) {
    buildPatch(
      stock,
      read,
      { uFrom: LAMP_FROM, uTo: LAMP_TO, ...flank },
      LAMP_PROUD,
      { u: LAMP_U_STEPS, p: LAMP_P_STEPS },
      mesh,
    )
  }
  return build(mesh)
}

/**
 * Built once per class of stock and shared by every train of it. These are
 * uploaded buffers rather than plain numbers, and there are dozens of trains
 * on the line at a time; one set between them is the whole saving.
 */
function shared(build: (stock: RollingStockConfig) => BufferGeometry) {
  const made = new WeakMap<RollingStockConfig, BufferGeometry>()

  return (stock: RollingStockConfig): BufferGeometry => {
    let geometry = made.get(stock)
    if (!geometry) {
      geometry = build(stock)
      made.set(stock, geometry)
    }
    return geometry
  }
}

export const bodyShell = shared(buildBodyShell)
export const noseShell = shared(buildNoseShell)
export const noseGlass = shared(buildNoseGlass)
export const noseLamps = shared(buildNoseLamps)

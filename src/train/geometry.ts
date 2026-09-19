import type { Panel, Vec3 } from '../components/InstancedParts'
import type { RollingStockConfig } from '../data/types'

/**
 * Everything needed to draw a train, derived from its RollingStockConfig.
 *
 * Same convention as the station: +X is the direction of travel, y = 0 is the
 * top of the rails. A train is drawn about its own centre, so berthing it at a
 * platform is a single group transform.
 *
 * The car side is a real wall with real holes in it rather than a solid box
 * with panes painted on: an outer skin, an air cavity, and the saloon lining
 * standing inside that, with the windows and doorways cut through all three.
 * That is what lets the player see out of a train they are riding, see into
 * one from the platform, and walk through an open doorway instead of into a
 * painted-on one (PLAN.md §1, §5).
 */

/** Underframe apron between the wheels and the saloon floor. */
export const UNDERFRAME_BOTTOM_Y = 0.78
export const UNDERFRAME_INSET = 0.2

/** Bogie frame box, in metres. */
export const BOGIE_LENGTH = 3.4
export const BOGIE_HEIGHT = 0.5
export const BOGIE_WIDTH = 2.1
export const BOGIE_CENTER_Y = 0.62

export const WHEEL_THICKNESS = 0.12

/**
 * How far the door leaves and the colour band stand proud of the body side.
 * Both are deliberately slight: the flush a modern car side is meant to have
 * is the difference between a metro box and something that looks fast.
 */
export const DOOR_PROUD = 0.018
/** The band sits proud of the door leaves so the livery runs unbroken along
 *  the whole car, as it does on the real stock. */
export const BAND_PROUD = 0.03

/** The three layers of a car side, outermost first. */
export const SKIN_THICKNESS = 0.06
export const LINING_GAP = 0.02
export const LINING_THICKNESS = 0.05

/** Partition between one car and the next, and the saloon floor and ceiling slabs. */
export const END_WALL_THICKNESS = 0.08
export const FLOOR_THICKNESS = 0.09
export const CEILING_THICKNESS = 0.06

/**
 * The streamlined lower fairing: a skirt carried down from the body side to
 * close off the running gear, broken only where a bogie needs the room. It is
 * what gives the car an unbroken flank from the LED strip down to the rail
 * instead of a body floating over a dark box.
 */
export const SKIRT_INSET = 0.03
export const SKIRT_THICKNESS = 0.06
const BOGIE_CLEARANCE = 0.22

/**
 * The LED strip along the cant rail: one continuous run of light down the
 * whole train, in the line's own colour (PLAN.md §10).
 *
 * It sits above every opening, which is the one course of the car side with
 * no doorway cut through it — so unlike the waist band it never has to break
 * for a door, and it really is continuous, across the car gaps as well.
 */
export const LED_HEIGHT = 0.07
export const LED_THICKNESS = 0.02
export const LED_PROUD = 0.012
const LED_RISE = 0.12

/** Bellows fairing closing the gap between two car bodies. */
const FAIRING_INSET = 0.09
const FAIRING_TOP_DROP = 0.16
const FAIRING_OVERLAP = 0.05

/** Matte panel laid along the flat of the roof, over the equipment wells. */
const ROOF_PANEL_MARGIN = 0.8
const ROOF_PANEL_INSET = 0.22
const ROOF_PANEL_THICKNESS = 0.05

/** Minimum body pillar between two window panes, in metres. */
const WINDOW_GAP = 0.25

/** Shadow gap where the two leaves of a shut door meet. */
const LEAF_GAP = 0.02

/**
 * The frame left around a door's glazing: a stile up each edge of the leaf
 * and a head rail across the top. A DMRC door is mostly window above the
 * waist, so the glass is set *into* the leaf rather than laid over it —
 * otherwise the leaf's own face is what you see from inside the saloon.
 */
const DOOR_STILE = 0.05
const DOOR_HEAD = 0.09

/** Slop below which two edges count as the same edge. */
const EPSILON = 1e-6

/** A run along the car side, in car-local X. */
export interface Span {
  min: number
  max: number
}

export interface DoorLeaf {
  /** Centre of the leaf with the door shut. */
  position: Vec3
  /** Which way along X the leaf runs as the door opens. */
  slide: 1 | -1
  /** Which side of the car the leaf is on: +1 for the +Z side, -1 for -Z. */
  side: 1 | -1
}

export interface CabEnd {
  /** X of the car's outer end face. */
  x: number
  /** +1 for the end facing +X, -1 for the end facing -X. */
  facing: 1 | -1
}

/** One piece of solid car side left between the openings, in car-local terms. */
export interface SidePanel {
  /** Centre of the piece: X within the car, Y above the saloon floor. */
  x: number
  y: number
  width: number
  height: number
}

export interface TrainLayout {
  /** Overall length over car bodies, in metres. */
  length: number
  /** X centre of each car. */
  carCenters: number[]
  /** Where one copy of the lofted roof shoulder goes: one per car. */
  carBodies: Vec3[]
  /** Matte panel laid along the flat of each car's roof. */
  roofPanels: Vec3[]
  /** The pierced car sides: outer skin only, both sides of every car. */
  skin: Panel[]
  /** Livery band, broken at the doorways; the leaves carry their own. */
  bands: Panel[]
  /** The continuous LED strip: one run per car side, plus one per car gap. */
  ledStrips: Panel[]
  /** Lower body fairing, broken where the bogies need the room. */
  skirts: Panel[]
  /** Bellows closing each gap between two car bodies. */
  fairings: Vec3[]
  underframes: Vec3[]
  bogies: Vec3[]
  wheels: Vec3[]
  /** The solid lower panel of each leaf. */
  doorLeaves: DoorLeaf[]
  /** The rail across the top of each leaf, over the glazing. */
  doorHeads: DoorLeaf[]
  /** Glazing, one pane per leaf, so it travels with the leaf it is set into. */
  doorGlass: DoorLeaf[]
  /** The livery band across each leaf, which opens with the door. */
  doorBands: DoorLeaf[]
  /** Window glazing, set into the opening rather than laid over the body. */
  windows: Vec3[]
  cabEnds: CabEnd[]
}

export function carPitch(stock: RollingStockConfig): number {
  return stock.carLength + stock.carGap
}

export function trainLength(stock: RollingStockConfig): number {
  return stock.carCount * carPitch(stock) - stock.carGap
}

/** X centre of each car, measured from the centre of the train. */
export function carCenters(stock: RollingStockConfig): number[] {
  const pitch = carPitch(stock)
  const length = trainLength(stock)
  return Array.from(
    { length: stock.carCount },
    (_, i) => -length / 2 + stock.carLength / 2 + i * pitch,
  )
}

export function bodyTopY(stock: RollingStockConfig): number {
  return stock.floorHeight + stock.bodyHeight
}

/** The crown of the roof: the highest point of the car body, above rail top. */
export function crownY(stock: RollingStockConfig): number {
  return bodyTopY(stock) + stock.roofHeight
}

/** Half the width of the flat of the roof, between the two shoulder curves. */
export function roofHalfWidth(stock: RollingStockConfig): number {
  return stock.carWidth / 2 - stock.roofInset / 2
}

/** Half the clear width inside the saloon, i.e. to the face of the lining. */
export function innerHalfWidth(stock: RollingStockConfig): number {
  return stock.carWidth / 2 - SKIN_THICKNESS - LINING_GAP - LINING_THICKNESS
}

/** Top of the tallest opening in the car side. Above this the body is solid. */
export function openingTopY(stock: RollingStockConfig): number {
  return Math.max(stock.doorHeight, stock.windowSill + stock.windowHeight)
}

/** The same, measured from rail top rather than from the saloon floor. */
export function openingTopAbs(stock: RollingStockConfig): number {
  return stock.floorHeight + openingTopY(stock)
}

/** Y of the continuous LED strip along the cant rail, above rail top. */
export function ledStripY(stock: RollingStockConfig): number {
  return openingTopAbs(stock) + LED_RISE
}

/**
 * Top of the saloon ceiling slab, above the floor. The car side is pierced
 * skin all the way up to here; only above it is the body a solid shoulder.
 * The saloon reaches well above the window heads, so a body that was solid
 * from there up would have its underside where the ceiling is meant to be.
 */
export function shellTopY(stock: RollingStockConfig): number {
  return stock.saloon.ceilingHeight + CEILING_THICKNESS
}

/** The same, measured from rail top: where the roof shoulder springs from. */
export function shellTopAbs(stock: RollingStockConfig): number {
  return stock.floorHeight + shellTopY(stock)
}

/** Half the length of one car's saloon, between its two end partitions. */
export function saloonHalfLength(stock: RollingStockConfig): number {
  return stock.carLength / 2 - END_WALL_THICKNESS
}

/** Local X of each door centre within a car. */
export function doorCentersX(stock: RollingStockConfig): number[] {
  const spacing = stock.carLength / stock.doorsPerSide
  return Array.from(
    { length: stock.doorsPerSide },
    (_, i) => -stock.carLength / 2 + (i + 0.5) * spacing,
  )
}

/** Width of one leaf of a bi-parting door. */
export function doorLeafWidth(stock: RollingStockConfig): number {
  return (stock.doorWidth - LEAF_GAP) / 2
}

/**
 * How far one leaf runs to open the door fully, in metres. Each leaf tucks
 * into the pocket beside its own doorway, leaving the whole doorway clear.
 */
export function doorLeafTravel(stock: RollingStockConfig): number {
  return stock.doorWidth / 2
}

/** Glazing width for one door leaf. */
export function doorGlassWidth(stock: RollingStockConfig): number {
  return doorLeafWidth(stock) - 2 * DOOR_STILE
}

/** Height of the glazed part of a door, above the solid lower panel. */
export function doorGlassHeight(stock: RollingStockConfig): number {
  return openingTopY(stock) - stock.windowSill - DOOR_HEAD
}

/** Height of the solid lower panel of a door, up to the glazing. */
export function doorPanelHeight(stock: RollingStockConfig): number {
  return stock.windowSill
}

/** Height of the rail across the top of a door, above the glazing. */
export function doorHeadHeight(): number {
  return DOOR_HEAD
}

/**
 * The runs of solid car side left between the doorways: the bays that carry
 * the windows outside and the benches inside.
 */
export function sideBays(stock: RollingStockConfig): Span[] {
  const halfDoor = stock.doorWidth / 2
  const halfCar = stock.carLength / 2

  const edges = [-halfCar]
  for (const door of doorCentersX(stock)) edges.push(door - halfDoor, door + halfDoor)
  edges.push(halfCar)

  const bays: Span[] = []
  for (let i = 0; i < edges.length; i += 2) {
    if (edges[i + 1] - edges[i] > EPSILON) bays.push({ min: edges[i], max: edges[i + 1] })
  }
  return bays
}

/**
 * Local X of each window pane within a car. Panes fill the bays left between
 * the doors and the car ends, as many as fit at the configured pane width.
 */
export function windowCentersX(stock: RollingStockConfig): number[] {
  const centers: number[] = []

  for (const bay of sideBays(stock)) {
    const span = bay.max - bay.min
    const panes = Math.floor(span / (stock.windowWidth + WINDOW_GAP))
    for (let pane = 0; pane < panes; pane++) {
      centers.push(bay.min + ((pane + 0.5) * span) / panes)
    }
  }
  return centers
}

/** What is left of `[from, to]` once the holes are taken out of it. */
function solidSpans(from: number, to: number, holes: readonly Span[]): Span[] {
  const sorted = [...holes].sort((a, b) => a.min - b.min)

  const spans: Span[] = []
  let edge = from

  for (const hole of sorted) {
    if (hole.min - edge > EPSILON) spans.push({ min: edge, max: Math.min(hole.min, to) })
    edge = Math.max(edge, hole.max)
  }
  if (to - edge > EPSILON) spans.push({ min: edge, max: to })

  return spans.filter((span) => span.max - span.min > EPSILON)
}

function centeredSpans(centers: readonly number[], width: number): Span[] {
  return centers.map((center) => ({ min: center - width / 2, max: center + width / 2 }))
}

/**
 * The car side cut into horizontal courses at every opening edge, so each
 * course can have its holes taken out of it along X alone.
 *
 * On the real stock the doors and the windows finish at the same height, which
 * leaves two courses: a skirt pierced only by the doorways, and a window band
 * pierced by both. Stock whose windows stop short of the door head simply gets
 * a third course, so the rule holds without the config having to say so.
 */
function sideCourses(stock: RollingStockConfig) {
  const doors = centeredSpans(doorCentersX(stock), stock.doorWidth)
  const windows = centeredSpans(windowCentersX(stock), stock.windowWidth)

  const sill = stock.windowSill
  const windowTop = sill + stock.windowHeight
  const doorTop = stock.doorHeight

  // The topmost course, from the window heads up to the ceiling, has no
  // holes in it: it is the same wall, carried on up past everything.
  const levels = [...new Set([0, sill, windowTop, doorTop, shellTopY(stock)])].sort(
    (a, b) => a - b,
  )

  const courses: { bottom: number; top: number; holes: Span[] }[] = []

  for (let i = 0; i < levels.length - 1; i++) {
    const bottom = levels[i]
    const top = levels[i + 1]
    if (top - bottom <= EPSILON) continue

    const holes: Span[] = []
    if (top <= doorTop + EPSILON) holes.push(...doors)
    if (bottom >= sill - EPSILON && top <= windowTop + EPSILON) holes.push(...windows)

    courses.push({ bottom, top, holes })
  }

  return courses
}

/**
 * The solid pieces of one car side, as centres and sizes in car-local terms.
 *
 * The same set describes the outer skin and the saloon lining — they are the
 * same wall seen from opposite faces — and it is mirrored to the other side of
 * the car, so this is computed once per stock and used four ways.
 */
export function sidePanels(stock: RollingStockConfig): SidePanel[] {
  const halfCar = stock.carLength / 2
  const panels: SidePanel[] = []

  for (const course of sideCourses(stock)) {
    for (const span of solidSpans(-halfCar, halfCar, course.holes)) {
      panels.push({
        x: (span.min + span.max) / 2,
        y: (course.bottom + course.top) / 2,
        width: span.max - span.min,
        height: course.top - course.bottom,
      })
    }
  }

  return panels
}

/**
 * The runs of lower body the skirt can close in: everything except the two
 * bogies, which have to be left open for the wheels to turn in.
 */
export function skirtSpans(stock: RollingStockConfig): Span[] {
  const halfCar = stock.carLength / 2
  const reach = BOGIE_LENGTH / 2 + BOGIE_CLEARANCE

  const holes = [-stock.bogiePivotSpacing / 2, stock.bogiePivotSpacing / 2].map((pivot) => ({
    min: pivot - reach,
    max: pivot + reach,
  }))

  return solidSpans(-halfCar, halfCar, holes)
}

/** Size of the bellows closing one gap between two car bodies. */
export function fairingSize(stock: RollingStockConfig): Vec3 {
  return [
    stock.carGap + 2 * FAIRING_OVERLAP,
    crownY(stock) - FAIRING_TOP_DROP - UNDERFRAME_BOTTOM_Y,
    stock.carWidth - 2 * FAIRING_INSET,
  ]
}

/** Size of the matte panel laid along the flat of one car's roof. */
export function roofPanelSize(stock: RollingStockConfig): Vec3 {
  return [
    stock.carLength - 2 * ROOF_PANEL_MARGIN,
    ROOF_PANEL_THICKNESS,
    2 * (roofHalfWidth(stock) - ROOF_PANEL_INSET),
  ]
}

export function trainLayout(stock: RollingStockConfig): TrainLayout {
  const length = trainLength(stock)
  const centers = carCenters(stock)
  const sideZ = stock.carWidth / 2

  const carBodies: Vec3[] = []
  const roofPanels: Vec3[] = []
  const skin: Panel[] = []
  const bands: Panel[] = []
  const ledStrips: Panel[] = []
  const skirts: Panel[] = []
  const fairings: Vec3[] = []
  const underframes: Vec3[] = []
  const bogies: Vec3[] = []
  const wheels: Vec3[] = []
  const doorLeaves: DoorLeaf[] = []
  const doorHeads: DoorLeaf[] = []
  const doorGlass: DoorLeaf[] = []
  const doorBands: DoorLeaf[] = []
  const windows: Vec3[] = []

  const floorY = stock.floorHeight
  const openingTop = openingTopY(stock)

  const roofPanelY = crownY(stock) - ROOF_PANEL_THICKNESS / 2
  const ledY = ledStripY(stock)
  const skirtY = (stock.skirtY + UNDERFRAME_BOTTOM_Y) / 2
  const skirtHeight = UNDERFRAME_BOTTOM_Y - stock.skirtY
  const fairingTop = crownY(stock) - FAIRING_TOP_DROP
  const bandY = floorY + stock.bandCenter
  const underframeY = (UNDERFRAME_BOTTOM_Y + stock.floorHeight) / 2
  // A door is a solid panel up to the sill, glass above it, and a head rail
  // across the top; all three slide together as one leaf.
  const doorPanelY = floorY + doorPanelHeight(stock) / 2
  const doorHeadY = floorY + openingTop - DOOR_HEAD / 2
  const doorGlassY = floorY + stock.windowSill + doorGlassHeight(stock) / 2
  const glassY = floorY + stock.windowSill + stock.windowHeight / 2
  const wheelY = stock.wheelDiameter / 2
  const railZ = stock.gauge / 2

  const skinZ = sideZ - SKIN_THICKNESS / 2
  const panels = sidePanels(stock)
  const localDoors = doorCentersX(stock)
  const localWindows = windowCentersX(stock)
  const bays = sideBays(stock)
  const skirtRuns = skirtSpans(stock)
  const leafOffset = stock.doorWidth / 4

  for (const carX of centers) {
    carBodies.push([carX, 0, 0])
    roofPanels.push([carX, roofPanelY, 0])
    underframes.push([carX, underframeY, 0])

    for (const side of [1, -1] as const) {
      for (const panel of panels) {
        skin.push({
          position: [carX + panel.x, floorY + panel.y, side * skinZ],
          size: [panel.width, panel.height, SKIN_THICKNESS],
        })
      }

      // One unbroken run from one end of the car to the other: this high up
      // the car side has nothing cut through it, so the strip never has to
      // break for a doorway the way the waist band does.
      ledStrips.push({
        position: [carX, ledY, side * (sideZ + LED_PROUD)],
        size: [stock.carLength, LED_HEIGHT, LED_THICKNESS],
      })

      for (const run of skirtRuns) {
        skirts.push({
          position: [carX + (run.min + run.max) / 2, skirtY, side * (sideZ - SKIRT_INSET)],
          size: [run.max - run.min, skirtHeight, SKIRT_THICKNESS],
        })
      }

      // The livery runs the length of the car but stops at each doorway: the
      // leaves carry the band across themselves and open with it.
      for (const bay of bays) {
        bands.push({
          position: [carX + (bay.min + bay.max) / 2, bandY, side * (sideZ + BAND_PROUD)],
          size: [bay.max - bay.min, stock.bandHeight, 0.02],
        })
      }

      for (const door of localDoors) {
        const doorX = carX + door

        // Bi-parting: the two leaves meet on the centreline of the doorway and
        // run apart from it.
        for (const slide of [-1, 1] as const) {
          const leafX = doorX + slide * leafOffset
          const leafZ = side * (sideZ + DOOR_PROUD)

          doorLeaves.push({ position: [leafX, doorPanelY, leafZ], slide, side })
          doorHeads.push({ position: [leafX, doorHeadY, leafZ], slide, side })
          // Set into the leaf, not laid over it, so the door is a window from
          // inside the saloon as well as from the platform.
          doorGlass.push({ position: [leafX, doorGlassY, leafZ], slide, side })
          doorBands.push({ position: [leafX, bandY, side * (sideZ + BAND_PROUD)], slide, side })
        }
      }

      for (const window of localWindows) {
        windows.push([carX + window, glassY, side * skinZ])
      }
    }

    for (const pivot of [-stock.bogiePivotSpacing / 2, stock.bogiePivotSpacing / 2]) {
      bogies.push([carX + pivot, BOGIE_CENTER_Y, 0])
      for (const axle of [-stock.bogieWheelbase / 2, stock.bogieWheelbase / 2]) {
        wheels.push([carX + pivot + axle, wheelY, railZ], [carX + pivot + axle, wheelY, -railZ])
      }
    }
  }

  // The gaps between the cars, closed in so that an eight-car set reads as
  // one continuous body rather than eight boxes in a row.
  for (let i = 0; i < centers.length - 1; i++) {
    const mid = (centers[i] + centers[i + 1]) / 2

    fairings.push([mid, (UNDERFRAME_BOTTOM_Y + fairingTop) / 2, 0])

    for (const side of [1, -1] as const) {
      ledStrips.push({
        position: [mid, ledY, side * (sideZ + LED_PROUD)],
        size: [stock.carGap + 2 * FAIRING_OVERLAP, LED_HEIGHT, LED_THICKNESS],
      })
    }
  }

  const cabEnds: CabEnd[] = [
    { x: -length / 2, facing: -1 },
    { x: length / 2, facing: 1 },
  ]

  return {
    length,
    carCenters: centers,
    carBodies,
    roofPanels,
    skin,
    bands,
    ledStrips,
    skirts,
    fairings,
    underframes,
    bogies,
    wheels,
    doorLeaves,
    doorHeads,
    doorGlass,
    doorBands,
    windows,
    cabEnds,
  }
}

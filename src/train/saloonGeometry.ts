import type { Panel, Vec3 } from '../components/InstancedParts'
import type { RollingStockConfig } from '../data/types'
import type { WalkArea, WalkObstacle } from '../systems/walk'
import {
  CEILING_THICKNESS,
  END_WALL_THICKNESS,
  FLOOR_THICKNESS,
  LINING_THICKNESS,
  carCenters,
  carPitch,
  doorCentersX,
  innerHalfWidth,
  openingTopY,
  saloonHalfLength,
  sideBays,
  sidePanels,
} from './geometry'

/**
 * The inside of a train, derived from its RollingStockConfig (PLAN.md §5).
 *
 * Built from `references/metro inside/`: longitudinal stainless benches down
 * both sides under the windows, floor-to-ceiling poles at every doorway and
 * down the middle of the aisle, two horizontal grab rails with hanging loops,
 * a flat ceiling with the air-conditioning duct along the centre and light
 * strips either side of it, and an open gangway through to the next car.
 *
 * Coordinates are the train's own, the same as the exterior: +X along the
 * train, y = 0 at rail top. Everything is mirrored about both axes, so a train
 * turned round to work the other road needs no special case.
 *
 * Nothing here knows about three.js or about React. `Saloon.tsx` draws it and
 * `carriage.ts` turns the same numbers into the floor the player walks on, so
 * the two can never disagree about where a bench is.
 */

/** An aisle pole only goes in a bay with room to walk past it. */
const MIN_AISLE_POLE_BAY = 3

/** Clearance left at each end of a bench, so it does not meet the door pocket. */
const BENCH_CLEARANCE = 0.1

/** How far a pole beside a doorway stands clear of the opening and the lining. */
const DOOR_POLE_MARGIN = 0.09
const DOOR_POLE_INSET = 0.08

export interface SaloonLayout {
  /** Lining, ceiling, duct and end walls: everything in the interior finish. */
  shell: Panel[]
  /** Saloon floor and the plates over the gangways. */
  floors: Panel[]
  /** The tactile strip across each doorway reveal. */
  sills: Panel[]
  /** The line-coloured band along the wall above the seat backs (PLAN.md §10). */
  bands: Panel[]
  seats: Panel[]
  /** Ceiling light strips, which are what actually light the saloon. */
  lights: Panel[]
  /** The route display over each doorway, in the line's colour. */
  displays: Panel[]
  /** Bellows between one car and the next. */
  gangways: Panel[]
  /** Floor-to-ceiling grab poles. */
  poles: Vec3[]
  poleHeight: number
  /** Horizontal grab rails, one each side of the aisle, one set per car. */
  rails: Vec3[]
  railLength: number
  /** Droppers carrying the rails off the ceiling. */
  droppers: Vec3[]
  dropperHeight: number
  /** Hanging grab handles, and the straps they hang on. */
  handles: Vec3[]
  straps: Panel[]
}

/** Evenly spread `count` points across a span. */
function spread(min: number, max: number, count: number): number[] {
  const step = (max - min) / count
  return Array.from({ length: count }, (_, i) => min + (i + 0.5) * step)
}

export function saloonLayout(stock: RollingStockConfig): SaloonLayout {
  const saloon = stock.saloon
  const centers = carCenters(stock)

  const floorY = stock.floorHeight
  const innerHalf = innerHalfWidth(stock)
  const halfLength = saloonHalfLength(stock)
  const openingTop = openingTopY(stock)
  const liningZ = innerHalf + LINING_THICKNESS / 2
  const ceiling = saloon.ceilingHeight

  const shell: Panel[] = []
  const floors: Panel[] = []
  const sills: Panel[] = []
  const bands: Panel[] = []
  const seats: Panel[] = []
  const lights: Panel[] = []
  const displays: Panel[] = []
  const gangways: Panel[] = []
  const poles: Vec3[] = []
  const rails: Vec3[] = []
  const droppers: Vec3[] = []
  const handles: Vec3[] = []
  const straps: Panel[] = []

  const panels = sidePanels(stock)
  const bays = sideBays(stock)
  const doors = doorCentersX(stock)

  const saloonLengthOfCar = halfLength * 2
  const railLength = saloonLengthOfCar - 0.2
  const lightZ = saloon.ductWidth / 2 + 0.3

  // The band sits in the gap between the top of the seat backs and the window
  // sill, which is the one stretch of wall you always see from a seat.
  const bandBottom = saloon.seatHeight + saloon.seatBackHeight
  const bandHeight = Math.max(0.05, stock.windowSill - bandBottom - 0.01)

  for (const carX of centers) {
    floors.push({
      position: [carX, floorY - FLOOR_THICKNESS / 2, 0],
      size: [saloonLengthOfCar, FLOOR_THICKNESS, innerHalf * 2],
    })

    shell.push({
      position: [carX, floorY + ceiling + CEILING_THICKNESS / 2, 0],
      size: [saloonLengthOfCar, CEILING_THICKNESS, innerHalf * 2],
    })
    shell.push({
      position: [carX, floorY + ceiling - saloon.ductDrop / 2, 0],
      size: [saloonLengthOfCar, saloon.ductDrop, saloon.ductWidth],
    })

    for (const z of [lightZ, -lightZ]) {
      lights.push({
        position: [carX, floorY + ceiling - 0.03, z],
        size: [saloonLengthOfCar - 0.4, 0.06, 0.16],
      })
    }

    for (const side of [1, -1] as const) {
      // The lining is the same wall as the outer skin seen from the inside, so
      // its windows and doorways line up with the skin's by construction, and
      // like the skin it runs on up to the ceiling above the window heads.
      for (const panel of panels) {
        shell.push({
          position: [carX + panel.x, floorY + panel.y, side * liningZ],
          size: [panel.width, panel.height, LINING_THICKNESS],
        })
      }


      for (const bay of bays) {
        const bayCenter = (bay.min + bay.max) / 2
        const bayLength = bay.max - bay.min
        const benchLength = bayLength - BENCH_CLEARANCE

        bands.push({
          position: [carX + bayCenter, floorY + bandBottom + bandHeight / 2, side * (innerHalf - 0.01)],
          size: [bayLength, bandHeight, 0.02],
        })

        // Pan, moulded back, and the valance closing the front of the bench.
        seats.push({
          position: [carX + bayCenter, floorY + saloon.seatHeight, side * (innerHalf - saloon.seatDepth / 2)],
          size: [benchLength, 0.07, saloon.seatDepth],
        })
        seats.push({
          position: [
            carX + bayCenter,
            floorY + saloon.seatHeight + saloon.seatBackHeight / 2,
            side * (innerHalf - 0.04),
          ],
          size: [benchLength, saloon.seatBackHeight, 0.07],
        })
        seats.push({
          position: [
            carX + bayCenter,
            floorY + (saloon.seatHeight - 0.04) / 2,
            side * (innerHalf - saloon.seatDepth + 0.04),
          ],
          size: [benchLength, saloon.seatHeight - 0.04, 0.05],
        })

        for (const x of spread(bay.min, bay.max, Math.max(1, Math.floor(bayLength / saloon.handleSpacing)))) {
          straps.push({
            position: [carX + x, floorY + saloon.railHeight - 0.07, side * saloon.railOffset],
            size: [0.022, 0.14, 0.05],
          })
          handles.push([
            carX + x,
            floorY + saloon.railHeight - 0.14 - saloon.handleRadius,
            side * saloon.railOffset,
          ])
        }
      }

      rails.push([carX, floorY + saloon.railHeight, side * saloon.railOffset])

      for (const door of doors) {
        const doorX = carX + door
        const half = stock.doorWidth / 2

        sills.push({
          position: [doorX, floorY - 0.015, side * (innerHalf + (stock.carWidth / 2 - innerHalf) / 2)],
          size: [stock.doorWidth, 0.03, stock.carWidth / 2 - innerHalf],
        })

        displays.push({
          position: [doorX, floorY + openingTop + 0.14, side * (innerHalf - 0.015)],
          size: [stock.doorWidth * 0.8, 0.2, 0.025],
        })

        droppers.push([doorX, floorY + (saloon.railHeight + ceiling) / 2, side * saloon.railOffset])

        for (const edge of [-1, 1] as const) {
          poles.push([
            doorX + edge * (half + DOOR_POLE_MARGIN),
            floorY + ceiling / 2,
            side * (innerHalf - DOOR_POLE_INSET),
          ])
        }
      }
    }

    // One pole down the middle of each long bay, as in the references. The
    // short bays over the bogies are left clear.
    for (const bay of bays) {
      if (bay.max - bay.min < MIN_AISLE_POLE_BAY) continue
      poles.push([carX + (bay.min + bay.max) / 2, floorY + ceiling / 2, 0])
    }
  }

  // End walls, with a gangway opening through all but the two cab ends.
  const halfGangway = saloon.gangwayWidth / 2
  const cheekWidth = stock.carWidth / 2 - halfGangway

  centers.forEach((carX, index) => {
    for (const end of [-1, 1] as const) {
      const x = carX + end * (stock.carLength / 2 - END_WALL_THICKNESS / 2)
      const cab = (index === 0 && end === -1) || (index === centers.length - 1 && end === 1)

      if (cab) {
        shell.push({
          position: [x, floorY + stock.bodyHeight / 2, 0],
          size: [END_WALL_THICKNESS, stock.bodyHeight, stock.carWidth],
        })
        continue
      }

      for (const side of [1, -1] as const) {
        shell.push({
          position: [x, floorY + stock.bodyHeight / 2, side * (halfGangway + cheekWidth / 2)],
          size: [END_WALL_THICKNESS, stock.bodyHeight, cheekWidth],
        })
      }

      shell.push({
        position: [x, floorY + (saloon.gangwayHeight + stock.bodyHeight) / 2, 0],
        size: [END_WALL_THICKNESS, stock.bodyHeight - saloon.gangwayHeight, saloon.gangwayWidth],
      })
    }
  })

  // The bellows bridging each gap, and the plate the player walks across.
  const gap = carPitch(stock) - 2 * halfLength
  for (let i = 0; i < centers.length - 1; i++) {
    const x = (centers[i] + centers[i + 1]) / 2

    for (const side of [1, -1] as const) {
      gangways.push({
        position: [x, floorY + saloon.gangwayHeight / 2, side * (halfGangway + 0.03)],
        size: [stock.carGap, saloon.gangwayHeight, 0.06],
      })
    }

    gangways.push({
      position: [x, floorY + saloon.gangwayHeight + 0.03, 0],
      size: [stock.carGap, 0.06, saloon.gangwayWidth + 0.12],
    })

    floors.push({
      position: [x, floorY - FLOOR_THICKNESS / 2, 0],
      size: [gap, FLOOR_THICKNESS, saloon.gangwayWidth],
    })
  }

  return {
    shell,
    floors,
    sills,
    bands,
    seats,
    lights,
    displays,
    gangways,
    poles,
    poleHeight: ceiling,
    rails,
    railLength,
    droppers,
    dropperHeight: ceiling - saloon.railHeight,
    handles,
    straps,
  }
}

export interface SaloonFloorPlan {
  /** The saloon floor, car by car, with the gangways joining them up. */
  areas: WalkArea[]
  /** Benches and aisle poles: what the player has to walk round. */
  obstacles: WalkObstacle[]
  /** One bridge per platform-side doorway, over the gap to the platform. */
  thresholds: WalkArea[]
}

/**
 * The same saloon as a floor the player can walk on (PLAN.md §12).
 *
 * Rectangles are measured from the train's centre and stay axis-aligned to the
 * world, because a train working the other road is only ever turned about Y by
 * half a turn and the saloon is symmetric about both axes. The one thing that
 * is not symmetric is which side the platform is on, and that is passed in.
 *
 * `reach` is how far out from the track centreline a doorway bridge extends;
 * it has to overlap the platform deck, or the player's body would find no
 * floor under it halfway across.
 */
export function saloonFloorPlan(
  stock: RollingStockConfig,
  platformSide: 1 | -1,
  reach: number,
): SaloonFloorPlan {
  const innerHalf = innerHalfWidth(stock)
  const halfLength = saloonHalfLength(stock)
  const halfGangway = stock.saloon.gangwayWidth / 2
  const floorY = stock.floorHeight
  const centers = carCenters(stock)

  const areas: WalkArea[] = []
  const obstacles: WalkObstacle[] = []
  const thresholds: WalkArea[] = []

  centers.forEach((carX, index) => {
    areas.push({
      id: `saloon-${index}`,
      minX: carX - halfLength,
      maxX: carX + halfLength,
      minZ: -innerHalf,
      maxZ: innerHalf,
      floorY,
    })

    // Shared edges are written from the same expression as the car floors
    // either side, so the walk system sees one continuous floor at the seam.
    if (index < centers.length - 1) {
      areas.push({
        id: `gangway-${index}`,
        minX: carX + halfLength,
        maxX: centers[index + 1] - halfLength,
        minZ: -halfGangway,
        maxZ: halfGangway,
        floorY,
      })
    }

    for (const bay of sideBays(stock)) {
      for (const side of [1, -1] as const) {
        const inboard = side * (innerHalf - stock.saloon.seatDepth)
        obstacles.push({
          id: `bench-${index}-${bay.min}-${side}`,
          minX: carX + bay.min,
          maxX: carX + bay.max,
          minZ: Math.min(inboard, side * innerHalf),
          maxZ: Math.max(inboard, side * innerHalf),
        })
      }

      if (bay.max - bay.min < MIN_AISLE_POLE_BAY) continue
      const poleX = carX + (bay.min + bay.max) / 2
      const poleHalf = stock.saloon.poleRadius + 0.02
      obstacles.push({
        id: `pole-${index}-${bay.min}`,
        minX: poleX - poleHalf,
        maxX: poleX + poleHalf,
        minZ: -poleHalf,
        maxZ: poleHalf,
      })
    }

    for (const door of doorCentersX(stock)) {
      const doorX = carX + door
      // Narrowed a little so the player squares up to the opening rather than
      // clipping the door frame on the way through.
      const half = stock.doorWidth / 2 - 0.08

      thresholds.push({
        id: `threshold-${index}-${door}`,
        minX: doorX - half,
        maxX: doorX + half,
        minZ: Math.min(platformSide * innerHalf, platformSide * reach),
        maxZ: Math.max(platformSide * innerHalf, platformSide * reach),
        floorY,
        closed: true,
      })
    }
  })

  return { areas, obstacles, thresholds }
}

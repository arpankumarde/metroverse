import type { RollingStockConfig } from './types'

/**
 * DMRC standard-gauge 8-car stock, as used on the Blue Line.
 *
 * Real figures: 2.9 m wide cars (narrower than the broad-gauge Yellow Line's
 * 3.2 m), 1.1 m floor for level boarding, 3.9 m to the roof, four double-leaf
 * doors per side per car.
 */
export const DMRC_STANDARD_GAUGE: RollingStockConfig = {
  id: 'dmrc-sg-8car',
  gauge: 1.435,
  carCount: 8,
  carLength: 20.8,
  carGap: 0.54,
  carWidth: 2.9,
  floorHeight: 1.1,
  bodyHeight: 2.65,
  roofHeight: 0.2,
  roofInset: 0.66,
  skirtY: 0.55,
  doorsPerSide: 4,
  doorWidth: 1.4,
  doorHeight: 1.9,
  windowSill: 0.95,
  windowHeight: 0.95,
  windowWidth: 1.5,
  bandCenter: 0.82,
  bandHeight: 0.18,
  wheelDiameter: 0.86,
  bogiePivotSpacing: 14,
  bogieWheelbase: 2.5,
  // A three-metre nose on a 2.9 m car: long enough to read as a high-speed
  // profile from the platform, short enough that an eight-car set still
  // berths inside a 180 m platform with room to spare.
  nose: {
    length: 3,
    tipHalfWidth: 0.085,
    tipTopY: 2.15,
    tipBottomY: 1.15,
  },
  saloon: {
    ceilingHeight: 2.25,
    ductDrop: 0.11,
    ductWidth: 0.92,
    seatHeight: 0.44,
    seatDepth: 0.46,
    seatBackHeight: 0.42,
    poleRadius: 0.019,
    railHeight: 1.88,
    railOffset: 0.74,
    handleSpacing: 0.9,
    handleRadius: 0.075,
    gangwayWidth: 1.4,
    gangwayHeight: 2,
  },
}

import type { RollingStockConfig } from '../data/types'
import type { WalkArea, WalkFrame, WalkVolume } from '../systems/walk'
import { saloonFloorPlan } from './saloonGeometry'

/**
 * A train as somewhere the player can stand (PLAN.md §5, §12).
 *
 * The saloon floor is a walk volume like any other, except that it is measured
 * from the carriage rather than from the world. The carriage *is* the walk
 * frame: the service writes where the train has got to into it every frame,
 * and the same rectangles then describe the floor wherever the train happens
 * to be. Boarding, riding and stepping off are all just the player walking
 * from one set of rectangles on to another — nothing switches modes.
 *
 * `carrying` comes back the other way: the player sets it on whichever frame
 * they are standing on, which is how the service knows there is somebody
 * aboard and that this train can no longer simply be cut away out of sight.
 */
export interface Carriage extends WalkFrame {
  /** The saloon floor and its fittings, measured from the train's centre. */
  volume: WalkVolume
  /**
   * The doorway bridges over the platform gap, held separately so the service
   * can open and shut them with the doors.
   */
  thresholds: WalkArea[]
}

/** How far past the platform edge a doorway bridge reaches, in metres. */
const THRESHOLD_OVERLAP = 0.35

/** Doors at least this far open are walkable; below it the bridge is shut. */
export const THRESHOLD_OPEN = 0.45

interface CarriageOptions {
  stock: RollingStockConfig
  /** Which side of the track the platform is on: +1 for +Z, -1 for -Z. */
  platformSide: 1 | -1
  /** Distance from the track centreline out to the platform edge. */
  platformEdgeOffset: number
}

/**
 * A carriage starts at the origin. Where it really is gets written into it
 * every frame by whatever is running the train, so there is nothing to place
 * here.
 */
export function createCarriage({
  stock,
  platformSide,
  platformEdgeOffset,
}: CarriageOptions): Carriage {
  const plan = saloonFloorPlan(stock, platformSide, platformEdgeOffset + THRESHOLD_OVERLAP)

  const carriage: Carriage = {
    x: 0,
    y: 0,
    z: 0,
    velocity: 0,
    acceleration: 0,
    carrying: false,
    // Nothing is reachable until a train has been put somewhere.
    inactive: true,
    volume: { areas: [], obstacles: [] },
    thresholds: plan.thresholds,
  }

  // Every rectangle is measured in this carriage's own frame, so pointing them
  // back at it is what makes the floor travel with the train.
  const areas = [...plan.areas, ...plan.thresholds]
  for (const area of areas) area.frame = carriage
  for (const obstacle of plan.obstacles) obstacle.frame = carriage

  carriage.volume = { areas, obstacles: plan.obstacles }

  return carriage
}

/** Open or shut every doorway bridge, following the doors themselves. */
export function setCarriageDoors(carriage: Carriage, open: number): void {
  const closed = open < THRESHOLD_OPEN
  for (const threshold of carriage.thresholds) threshold.closed = closed
}

/**
 * Tell a train whether the player is riding in it, and whether its floor is
 * within reach at all.
 *
 * The player boards by walking in, so nothing announces it: the carriage
 * finds out because the player marks the floor they are standing on, and the
 * train finds out from here. It matters because a train carrying somebody
 * cannot be recycled into the standby pool or run off the end of the built
 * line (PLAN.md §5, §7).
 *
 * The runtime is taken structurally rather than as a `TrainRuntime`, so a
 * carriage still knows nothing about the state machine driving it.
 */
export function reportCarriage(
  runtime: { carrying: boolean },
  carriage: Carriage,
  reachable: boolean,
): void {
  runtime.carrying = carriage.carrying
  carriage.inactive = !reachable
}

/** Exponential rate at which the measured acceleration settles. */
const ACCELERATION_SMOOTHING = 8

/**
 * A step further than this is a train being placed rather than a train
 * moving — a working being launched, or a tab coming back from the
 * background — and must not be read as a lurch.
 */
const PLACEMENT_JUMP = 20

/**
 * Put the carriage where its train has got to, and work out what that feels
 * like from inside.
 *
 * Speed and acceleration are measured from the movement itself rather than
 * taken from the runtime, so a carriage does not need to know which way its
 * road runs, and so the ride reflects exactly what the player's floor did.
 */
export function driveCarriage(
  carriage: Carriage,
  x: number,
  y: number,
  z: number,
  delta: number,
): void {
  const moved = x - carriage.x

  if (delta <= 0 || Math.abs(moved) > PLACEMENT_JUMP) {
    carriage.velocity = 0
    carriage.acceleration = 0
  } else {
    const velocity = moved / delta
    const rate = (velocity - carriage.velocity) / delta
    carriage.acceleration += (rate - carriage.acceleration) * (1 - Math.exp(-ACCELERATION_SMOOTHING * delta))
    carriage.velocity = velocity
  }

  carriage.x = x
  carriage.y = y
  carriage.z = z
}

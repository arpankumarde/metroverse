import { Shape } from 'three'
import type { Vec3 } from '../components/InstancedParts'
import type { CanopyConfig } from '../data/types'

/**
 * The barrel vault over an elevated platform, derived from its CanopyConfig.
 *
 * The vault is a half-ellipse in the ZY plane extruded along the track. It is
 * parameterised by `u`, which runs -1 at the left springing, through 0 at the
 * crown, to +1 at the right springing — so anything that needs to be placed
 * "a third of the way up the arch" can say so without redoing the maths.
 */

/** Straight segments per face of the vault. Enough that the crown reads as a curve. */
const ARCH_SEGMENTS = 40

/** How many longitudinal purlins run under the shell, crown included. */
const PURLIN_COUNT = 9

/** Purlins stop short of the springing, where the columns are instead. */
const PURLIN_SPREAD = 0.84

export interface ArchPoint {
  z: number
  y: number
  /**
   * Rotation about +X that lays a flat part against the shell here: a box
   * spanning the track in X is tilted by this to sit flush under the vault.
   */
  tilt: number
}

export interface Placement {
  position: Vec3
  rotation: Vec3
}

/**
 * A point on the vault's inner face, pushed `inset` metres in along the
 * ellipse's own axes — enough to tuck ribs and purlins under the shell.
 */
export function archPoint(canopy: CanopyConfig, u: number, inset = 0): ArchPoint {
  const t = (u * Math.PI) / 2
  const halfSpan = canopy.halfSpan - inset
  const rise = canopy.rise - inset

  return {
    z: halfSpan * Math.sin(t),
    y: canopy.springY + rise * Math.cos(t),
    tilt: Math.atan2(rise * Math.sin(t), halfSpan * Math.cos(t)),
  }
}

/**
 * Cross-section of the roof shell: the inner face swept left to right, then
 * the outer face back again, closed off flat at each springing.
 *
 * Laid out as (z, y) so it extrudes along the track; the component that uses
 * it turns the extrusion to face down the line.
 */
export function archShape(canopy: CanopyConfig): Shape {
  const shape = new Shape()

  for (let i = 0; i <= ARCH_SEGMENTS; i++) {
    const { z, y } = archPoint(canopy, -1 + (2 * i) / ARCH_SEGMENTS)
    if (i === 0) shape.moveTo(z, y)
    else shape.lineTo(z, y)
  }

  for (let i = ARCH_SEGMENTS; i >= 0; i--) {
    const { z, y } = archPoint(canopy, -1 + (2 * i) / ARCH_SEGMENTS, -canopy.thickness)
    shape.lineTo(z, y)
  }

  shape.closePath()
  return shape
}

/** X of each arch rib, spread evenly over the sheltered length. */
export function ribCentersX(canopy: CanopyConfig): number[] {
  const count = Math.max(2, Math.round(canopy.length / canopy.ribSpacing))
  const pitch = canopy.length / (count - 1)
  return Array.from({ length: count }, (_, i) => -canopy.length / 2 + i * pitch)
}

/** Centreline of one rib, as points to sweep a tube along. */
export function ribCurvePoints(canopy: CanopyConfig): ArchPoint[] {
  return Array.from({ length: ARCH_SEGMENTS + 1 }, (_, i) =>
    archPoint(canopy, -1 + (2 * i) / ARCH_SEGMENTS, canopy.ribRadius),
  )
}

/**
 * The longitudinal purlins tying the ribs together, each tilted to lie flat
 * against the shell.
 */
export function purlinPlacements(canopy: CanopyConfig): Placement[] {
  const inset = canopy.ribRadius * 2

  return Array.from({ length: PURLIN_COUNT }, (_, i) => {
    const u = PURLIN_SPREAD * (-1 + (2 * i) / (PURLIN_COUNT - 1))
    const { z, y, tilt } = archPoint(canopy, u, inset)
    return { position: [0, y, z] as Vec3, rotation: [tilt, 0, 0] as Vec3 }
  })
}

/** The `u` at which the vault crosses a given Z, for hanging things off it. */
export function archUForZ(canopy: CanopyConfig, z: number): number {
  const ratio = Math.min(1, Math.max(-1, z / canopy.halfSpan))
  return (2 * Math.asin(ratio)) / Math.PI
}

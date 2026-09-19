import { corridorEnd, corridorStart } from '../data/corridor'
import { stretchesBelow, type Stretch } from '../data/alignment'
import type { CorridorConfig, VerticalAlignment } from '../data/types'
import { GROUND_Y } from './Daylight'

/**
 * The box the line runs in where it is under the street (PLAN.md §6, §19).
 *
 * Everything here is measured from rail top, exactly as the station and the
 * train are, so the bore sits around whatever height the alignment has put
 * the rails at without anything having to convert between two ideas of zero.
 *
 * A twin-track cut-and-cover box: a flat invert the trackbeds sit on, a wall
 * up each side with a walkway and cable route along it, and a flat roof slab
 * with the road on top of it. Not a bored tube, because the stretch this
 * corridor dives under is a road, and a road is what you cut and cover.
 */

/** Half the clear width inside the box. Two 2.9 m cars at 4 m centres, plus walkways. */
export const BORE_HALF_WIDTH = 5.6

/** Underside of the roof slab, above rail top. Clears the 3.95 m car roof and the overhead. */
export const SOFFIT_Y = 5.4

/** Top of the invert slab, just below the bottom of the trackbed. */
export const INVERT_TOP_Y = -0.85

export const WALL_THICKNESS = 0.6
export const ROOF_THICKNESS = 0.7
export const INVERT_THICKNESS = 0.7

/** Outermost face of the structure, either side of the centreline. */
export const BOX_HALF_WIDTH = BORE_HALF_WIDTH + WALL_THICKNESS

/** Top of the roof slab and bottom of the invert, relative to rail top. */
export const BOX_TOP_Y = SOFFIT_Y + ROOF_THICKNESS
export const BOX_BOTTOM_Y = INVERT_TOP_Y - INVERT_THICKNESS

/**
 * Rail top at the portal: the height at which the box, sunk as far as its own
 * depth below the rails, first has the street over it rather than under it.
 *
 * Above this the line is out in the air on viaduct; at or below it the line
 * is covered. Nobody writes down where the portals are — they are wherever
 * the alignment crosses this, so moving a ramp moves its portal with it
 * (PLAN.md §33).
 */
export const PORTAL_RAIL_Y = GROUND_Y - BOX_BOTTOM_Y

/** The raised walkway along each wall, for the look of an evacuation route. */
export const WALKWAY_TOP_Y = 0.25
export const WALKWAY_WIDTH = 1.5

/** Cable route carried on brackets up the wall. */
export const CABLE_TRAY_Y = 2.1
export const CABLE_TRAY_DEPTH = 0.34

/** Tunnel lighting: a strip on each wall, this far apart along the bore. */
export const LIGHT_SPACING = 11
export const LIGHT_Y = 4.3
export const LIGHT_LENGTH = 1.6

/** Length of one drawn ring of box, on the level and on a ramp. */
export const RING_LEVEL = 55
export const RING_GRADED = 36

/** How much of the bore is built as one cullable chunk, in metres. */
export const BAY_LENGTH = 150

/** How far the portal headwall stands proud of the bore, along the line. */
export const HEADWALL_THICKNESS = 1.3
/** How far the headwall rises above the roof slab. */
export const HEADWALL_PARAPET = 0.9

/** Every stretch of a corridor that runs covered, in chainage order. */
export function tunnelStretches(
  corridor: CorridorConfig,
  alignment: VerticalAlignment,
): Stretch[] {
  return stretchesBelow(
    alignment,
    corridorStart(corridor),
    corridorEnd(corridor),
    PORTAL_RAIL_Y,
  )
}

/**
 * Whether a portal is a real tunnel mouth or just the end of the built world.
 *
 * The Dwarka end of this corridor runs on into the dark rather than climbing
 * back out, so the box simply stops where the line stops. Putting a headwall
 * there would be walling off a tunnel the trains come out of.
 */
export function isPortal(corridor: CorridorConfig, x: number): boolean {
  const slack = 1
  return (
    Math.abs(x - corridorStart(corridor)) > slack && Math.abs(x - corridorEnd(corridor)) > slack
  )
}

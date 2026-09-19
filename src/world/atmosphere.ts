/**
 * The Delhi haze (PLAN.md §19, §26).
 *
 * Distance reads as a flat bright wash rather than a hard horizon, which is
 * both how the city looks and what lets a train run in and out of sight
 * without ever being seen to appear.
 *
 * It is also the render budget: nothing past the far end of the fog is
 * visible, so nothing past it is drawn (PLAN.md §28). Everything that culls
 * itself by distance measures against `VIEW_DISTANCE`, so the haze and the
 * culling can never drift apart and leave things fading out in plain sight.
 */

export const HAZE_COLOR = '#c3ccd6'
export const HAZE_NEAR = 80
export const HAZE_FAR = 340

/** A little past the fog, so nothing is cut while it is still faintly there. */
export const VIEW_DISTANCE = HAZE_FAR + 60

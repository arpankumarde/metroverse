import type { MetroLine } from './types'

/**
 * Line 3/4, Dwarka Sector 21 <-> Noida Electronic City / Vaishali.
 * Standard gauge, 8-car stock, 25 kV overhead. The colour here is the single
 * source of line identity: train livery, HUD, map and signage all read it
 * (PLAN.md §10). It is the published Blue Line blue darkened a little for
 * daylight, which is why it is not verbatim the one in `lines/blue.json`;
 * that file is the route, and this is how the route is painted.
 *
 * Which stations the line calls at is not here either — `route.ts` reads
 * them from `lines/blue.json`, and `corridor.ts` says which of them are
 * built.
 */
export const BLUE_LINE: MetroLine = {
  id: 'blue',
  name: { hi: 'ब्लू लाइन', en: 'Blue Line' },
  color: '#0b5cab',
}

export const LINES: Record<string, MetroLine> = {
  [BLUE_LINE.id]: BLUE_LINE,
}

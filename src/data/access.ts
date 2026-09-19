/**
 * Vertical access: the staircases and escalators that drop off a platform to
 * the concourse below (PLAN.md §8, §12).
 *
 * Every dimension is measured the same way a platform's own fittings are — X
 * along the track from the station centre, and depth as an inset from the
 * track-side platform edge — so one entry describes the same arrangement on a
 * left-hand and a right-hand platform, and the mirroring falls out.
 *
 * Every platform on the corridor has the same standard pair, so a new
 * station needs nothing here; one that is arranged differently is an entry in
 * the override table at the bottom of this file and nothing else.
 */

export const AccessKind = {
  STAIRS: 'STAIRS',
  ESCALATOR: 'ESCALATOR',
} as const

export type AccessKind = (typeof AccessKind)[keyof typeof AccessKind]

export interface VerticalAccessConfig {
  id: string
  kind: AccessKind
  /** Centre of the deck opening along the track, in metres from the station centre. */
  x: number
  /** Length of the deck opening along the track. */
  length: number
  /** Distance from the platform's track-side edge to the near side of the opening. */
  inset: number
  /** Depth of the opening across the platform. */
  width: number
  /** Which way the flight descends: +1 towards +X, -1 towards -X. */
  descent: 1 | -1
  /** Y of the concourse floor the flight lands on, relative to rail top. */
  landingY: number
}

/** The concourse sits one level below the platforms at an elevated station. */
const CONCOURSE_Y = -4.2

/**
 * The standard pair, which every platform on the corridor has: an escalator
 * down towards the Dwarka end and a staircase down towards the Noida end,
 * set back from the standing area but clear of the bench line along the back
 * wall. A station that is arranged differently overrides it below.
 */
function standardAccess(platformId: string): VerticalAccessConfig[] {
  return [
    {
      id: `${platformId}-escalator`,
      kind: AccessKind.ESCALATOR,
      x: 20,
      length: 6.4,
      inset: 3.9,
      width: 1.7,
      descent: -1,
      landingY: CONCOURSE_Y,
    },
    {
      id: `${platformId}-stairs`,
      kind: AccessKind.STAIRS,
      x: 44,
      length: 7,
      inset: 3.9,
      width: 2,
      descent: 1,
      landingY: CONCOURSE_Y,
    },
  ]
}

/** Platforms whose access is not the standard pair. */
const VERTICAL_ACCESS: Record<string, VerticalAccessConfig[]> = {}

/** What drops off a given platform. */
export function accessForPlatform(platformId: string): VerticalAccessConfig[] {
  return VERTICAL_ACCESS[platformId] ?? standardAccess(platformId)
}

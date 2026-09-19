/**
 * Vertical access: the staircases and escalators that connect a platform to
 * the concourse below it, and the concourse itself (PLAN.md §8, §12).
 *
 * Every dimension is measured the same way a platform's own fittings are — X
 * along the track from the station centre, and depth as an inset from the
 * track-side platform edge — so one entry describes the same arrangement on a
 * left-hand and a right-hand platform, and the mirroring falls out.
 *
 * Every platform on the corridor has the same standard set, so a new station
 * needs nothing here; one that is arranged differently is an entry in the
 * override table at the bottom of this file and nothing else.
 */

export const AccessKind = {
  STAIRS: 'STAIRS',
  ESCALATOR: 'ESCALATOR',
} as const

export type AccessKind = (typeof AccessKind)[keyof typeof AccessKind]

/**
 * Which way a flight can be used. A staircase goes both ways; an escalator
 * goes one, so a platform needs a pair of them to have both.
 */
export const Travel = {
  UP: 'UP',
  DOWN: 'DOWN',
  BOTH: 'BOTH',
} as const

export type Travel = (typeof Travel)[keyof typeof Travel]

export interface VerticalAccessConfig {
  id: string
  kind: AccessKind
  /** Which way it carries people; `BOTH` for anything they walk themselves. */
  travel: Travel
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

/**
 * Floor of the concourse, below rail top.
 *
 * Fixed by what has to fit: the underside of the viaduct deck is 1.8 m below
 * rail top, and a hall wants the better part of three and a half metres of
 * air under it; and the floor has to stay well clear of the street, which is
 * 9.2 m down. A platform is 1.1 m above rail top, so this is a climb of 6.1 m
 * — a little over a storey and a half, which is what an elevated station's
 * concourse really is.
 */
export const CONCOURSE_Y = -5

/**
 * The concourse hall, sized to what it has to contain.
 *
 * It is not written down as a rectangle: it runs as far as the flights need
 * it to, plus room to stand at the foot of each, so moving a staircase moves
 * the hall with it.
 */
export interface ConcourseConfig {
  floorY: number
  /** How far the hall runs on along the track past the foot of the outermost flight. */
  overrun: number
  /** Clear width left beside the outermost flight, between it and the wall. */
  sideRoom: number
}

export const CONCOURSE: ConcourseConfig = {
  floorY: CONCOURSE_Y,
  overrun: 9,
  sideRoom: 0.4,
}

/** How fast an escalator's steps travel along the incline. DMRC specify 0.65 m/s. */
export const ESCALATOR_SPEED = 0.65

/**
 * The standard set, which every platform on the corridor has: a pair of
 * escalators, one up and one down, side by side, and a staircase beyond them.
 *
 * They are set back from the standing area and clear of the bins and the bench
 * line along the back wall, with the escalators' heads at the end towards the
 * staircase, so that the space between the two is where people gather to
 * choose between them. A station that is arranged differently overrides it
 * below.
 */
function standardAccess(platformId: string): VerticalAccessConfig[] {
  return [
    {
      id: `${platformId}-escalator-down`,
      kind: AccessKind.ESCALATOR,
      travel: Travel.DOWN,
      x: 28,
      length: 6.4,
      inset: 3.3,
      width: 1.7,
      descent: -1,
      landingY: CONCOURSE_Y,
    },
    {
      id: `${platformId}-escalator-up`,
      kind: AccessKind.ESCALATOR,
      travel: Travel.UP,
      x: 28,
      length: 6.4,
      inset: 5.3,
      width: 1.7,
      descent: -1,
      landingY: CONCOURSE_Y,
    },
    {
      id: `${platformId}-stairs`,
      kind: AccessKind.STAIRS,
      travel: Travel.BOTH,
      x: 44,
      length: 7,
      inset: 3.3,
      width: 2,
      descent: 1,
      landingY: CONCOURSE_Y,
    },
  ]
}

/** Platforms whose access is not the standard set. */
const VERTICAL_ACCESS: Record<string, VerticalAccessConfig[]> = {}

/** What drops off a given platform. */
export function accessForPlatform(platformId: string): VerticalAccessConfig[] {
  return VERTICAL_ACCESS[platformId] ?? standardAccess(platformId)
}

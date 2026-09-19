import type { Vec3 } from '../components/InstancedParts'
import {
  AccessKind,
  ESCALATOR_SPEED,
  Travel,
  accessForPlatform,
  type VerticalAccessConfig,
} from '../data/access'
import type { PlatformConfig, TrackConfig } from '../data/types'
import type { WalkArea, WalkObstacle } from '../systems/walk'
import { rectBetweenZ, rectsAround, type Rect } from './deck'
import { TRACK_BASE_Y, platformLayout } from './geometry'

/**
 * Staircases and escalators, resolved from their config into world geometry.
 *
 * Same split as the rest of the station: this module does the arithmetic and
 * knows nothing about materials, `VerticalAccess` draws it, and `walkable`
 * collides against the very same openings — so the hole the player sees and
 * the hole they can fall down are one hole (PLAN.md §12, §33).
 *
 * A flight is drawn and walked from the same numbers. The floor a player
 * stands on falls at the gradient the steps are drawn at, and an escalator's
 * belt carries them at the speed its steps are animated at, so what they see
 * moving and what moves them cannot disagree.
 */

/** Riser and going the step count is fitted to. Close to the DMRC public stair. */
const STAIR_RISER = 0.165
const STAIR_GOING = 0.3

/** Escalators are built to a fixed 30 degrees. */
export const ESCALATOR_ANGLE = Math.PI / 6

/** Pitch of the cleats that read as escalator steps, along the incline. */
export const CLEAT_PITCH = 0.4

/** How far the balustrade runs on past the head of the flight. */
const HEAD_EXTENSION = 0.3

/** Thickness of the balustrade panel standing along each side of a flight. */
export const BALUSTRADE_THICKNESS = 0.09

/**
 * How much more than the flight itself the deck and the hall floor leave open
 * across its width, so the balustrades stand in the hole and not on its lip.
 */
const WELL_MARGIN = 0.06

/** Depth of the step band of an escalator, and the truss body under it. */
const ESCALATOR_BAND = 0.2

/** Clear height a person needs to pass under the platform slab, head included. */
const HEADROOM = 1.75

/** How much of full walking speed a person manages on each. Nobody runs stairs. */
const STAIR_PACE = 0.7
const ESCALATOR_PACE = 0.9

export interface AccessLayout {
  id: string
  kind: AccessKind
  travel: Travel
  /** The hole in the deck, in world coordinates. */
  opening: Rect
  /**
   * The whole flight in plan, from its head on the deck to its foot in the
   * hall. Most of it is under the deck: the opening only has to be as long as
   * it takes a person on the flight to duck under the slab.
   */
  footprint: Rect
  /**
   * The footprint with room either side for the balustrades: what the viaduct
   * deck and the hall floor are cut back to around it.
   */
  well: Rect
  deckY: number
  landingY: number
  /** X of the top of the flight, i.e. the lip the player steps off. */
  headX: number
  /** X of the foot of the flight, where it lands in the hall. */
  toeX: number
  descent: 1 | -1
  centerZ: number
  halfWidth: number
  /** Height climbed, and the distance covered along X doing it. */
  rise: number
  run: number
  /** Angle of the incline, and the rotation about Z that lays an X-aligned part along it. */
  pitch: number
  tilt: number
  /** Centre of the flight on its nosing line, and its length down the slope. */
  flightCenter: Vec3
  flightLength: number
  /** The same, extended past the head where the balustrade overruns. */
  railCenter: Vec3
  railLength: number
  /** Riser and tread of a staircase; both are zero for an escalator. */
  stepCount: number
  riser: number
  /** Centres of the safety nosings along a staircase; empty for an escalator. */
  nosings: Vec3[]
  /** How many moving steps an escalator carries along its length. */
  cleatCount: number
  /**
   * The solid under the flight, as a profile in station-local X and Y, to be
   * extruded across the flight's width. Tread by tread for a staircase, a plain
   * wedge for an escalator's truss.
   */
  body: [number, number][]
  /** Guard rail across the far end of the opening, where the flight ducks under. */
  endRailCenter: Vec3
  /** Speed of an escalator's steps along X, signed; zero for a staircase. */
  beltX: number
}

/**
 * The opening in the deck has to be long enough for somebody standing on the
 * flight to have their head below the slab by the time it stops. A staircase
 * or escalator moved or re-graded in the data that no longer clears is caught
 * here, when the station is built, rather than found by walking into a ceiling.
 */
function checkHeadroom(config: VerticalAccessConfig, deckY: number, gradient: number, going: number) {
  const needed = (deckY - (TRACK_BASE_Y - HEADROOM)) / gradient + going
  if (config.length + 1e-6 < needed) {
    throw new Error(
      `${config.id}: opening is ${config.length} m long but a person needs ${needed.toFixed(2)} m ` +
        'of it to clear the platform slab',
    )
  }
}

function layoutFor(
  config: VerticalAccessConfig,
  platform: PlatformConfig,
  track: TrackConfig,
): AccessLayout {
  const { edgeZ, sideSign, deckY } = platformLayout(platform, track)

  const nearZ = edgeZ + sideSign * config.inset
  const farZ = edgeZ + sideSign * (config.inset + config.width)
  const opening = rectBetweenZ(
    config.x - config.length / 2,
    config.x + config.length / 2,
    nearZ,
    farZ,
  )

  const centerZ = (nearZ + farZ) / 2
  const halfWidth = config.width / 2

  const rise = deckY - config.landingY
  const headX = config.descent > 0 ? opening.minX : opening.maxX

  const stairs = config.kind === AccessKind.STAIRS
  const stepCount = Math.max(1, Math.round(rise / STAIR_RISER))
  const riser = rise / stepCount
  const run = stairs ? stepCount * STAIR_GOING : rise / Math.tan(ESCALATOR_ANGLE)
  const toeX = headX + config.descent * run

  checkHeadroom(config, deckY, rise / run, stairs ? STAIR_GOING : 0)

  // A box whose long axis is X is laid along the flight by this one rotation.
  // The box is symmetric, so descending towards -X is the same tilt mirrored.
  const pitch = Math.atan2(rise, run)
  const tilt = config.descent > 0 ? -pitch : pitch

  const flightLength = Math.hypot(run, rise)
  const flightCenter: Vec3 = [headX + config.descent * (run / 2), deckY - rise / 2, centerZ]

  // The balustrade overruns the head, so its centre slides that far up-slope.
  const railLength = flightLength + HEAD_EXTENSION
  const up = HEAD_EXTENSION / 2 / flightLength
  const railCenter: Vec3 = [
    flightCenter[0] - config.descent * run * up,
    flightCenter[1] + rise * up,
    centerZ,
  ]

  const footprint: Rect = rectBetweenZ(Math.min(headX, toeX), Math.max(headX, toeX), nearZ, farZ)
  const well: Rect = {
    ...footprint,
    minZ: footprint.minZ - WELL_MARGIN,
    maxZ: footprint.maxZ + WELL_MARGIN,
  }

  // Safety nosings sit on the leading edge of every tread but the last, which
  // is the hall floor, and whose edge is the foot of the flight.
  const nosings: Vec3[] = stairs
    ? Array.from({ length: stepCount - 1 }, (_, i) => [
        headX + config.descent * ((i + 1) * STAIR_GOING - 0.03),
        deckY - (i + 1) * riser + 0.006,
        centerZ,
      ])
    : []

  const cleatCount = stairs ? 0 : Math.floor(flightLength / CLEAT_PITCH)

  return {
    id: config.id,
    kind: config.kind,
    travel: config.travel,
    opening,
    footprint,
    well,
    deckY,
    landingY: config.landingY,
    headX,
    toeX,
    descent: config.descent,
    centerZ,
    halfWidth,
    rise,
    run,
    pitch,
    tilt,
    flightCenter,
    flightLength,
    railCenter,
    railLength,
    stepCount: stairs ? stepCount : 0,
    riser: stairs ? riser : 0,
    nosings,
    cleatCount,
    body: stairs
      ? stairBody(headX, config.descent, deckY, config.landingY, stepCount, riser)
      : wedgeBody(headX, config.descent, deckY, config.landingY, pitch),
    endRailCenter: [config.descent > 0 ? opening.maxX : opening.minX, deckY, centerZ],
    beltX: stairs ? 0 : beltVelocity(config) * Math.cos(ESCALATOR_ANGLE),
  }
}

/**
 * Along-X velocity of an escalator's steps. An up escalator's surface moves
 * towards the head, which is back the way the flight descends; a down one, the
 * way it descends.
 */
function beltVelocity(config: VerticalAccessConfig): number {
  if (config.kind !== AccessKind.ESCALATOR || config.travel === Travel.BOTH) return 0
  const along = config.travel === Travel.DOWN ? config.descent : -config.descent
  return along * ESCALATOR_SPEED
}

/** The tread-by-tread profile of the solid under a staircase, head to foot. */
function stairBody(
  headX: number,
  descent: 1 | -1,
  deckY: number,
  landingY: number,
  stepCount: number,
  riser: number,
): [number, number][] {
  const profile: [number, number][] = [
    [headX, landingY],
    [headX, deckY - riser],
  ]

  // Each tread runs on to the edge above the next, then drops a riser. The
  // last tread is the hall floor and has no thickness, so the profile ends
  // with the riser down on to it.
  for (let step = 1; step < stepCount; step++) {
    const x = headX + descent * step * STAIR_GOING
    profile.push([x, deckY - step * riser], [x, deckY - (step + 1) * riser])
  }

  return profile
}

/** The solid under an escalator: a wedge whose top is the underside of the step band. */
function wedgeBody(
  headX: number,
  descent: 1 | -1,
  deckY: number,
  landingY: number,
  pitch: number,
): [number, number][] {
  const drop = ESCALATOR_BAND / Math.cos(pitch)
  const reach = (deckY - drop - landingY) / Math.tan(pitch)

  return [
    [headX, landingY],
    [headX, deckY - drop],
    [headX + descent * reach, landingY],
  ]
}

export function accessLayouts(platform: PlatformConfig, track: TrackConfig): AccessLayout[] {
  return accessForPlatform(platform.id).map((config) => layoutFor(config, platform, track))
}

/**
 * The deck a platform actually has, once its openings are taken out — the
 * slabs `Platform` draws and the floor `walkable` lets the player stand on.
 */
export function platformDeckRects(platform: PlatformConfig, track: TrackConfig): Rect[] {
  const { centerZ } = platformLayout(platform, track)

  const outer: Rect = {
    minX: -platform.length / 2,
    maxX: platform.length / 2,
    minZ: centerZ - platform.width / 2,
    maxZ: centerZ + platform.width / 2,
  }

  return rectsAround(
    outer,
    accessLayouts(platform, track).map((layout) => layout.opening),
  )
}

export function platformDeckAreas(platform: PlatformConfig, track: TrackConfig): WalkArea[] {
  const { deckY } = platformLayout(platform, track)

  return platformDeckRects(platform, track).map((rect, index) => ({
    id: `${platform.id}-deck-${index}`,
    ...rect,
    floorY: deckY,
  }))
}

/**
 * The flights themselves as floors to walk on: a slope that starts level with
 * the deck at the head of each and falls to the hall floor at its foot.
 *
 * A staircase falls a tread at a time and slows whoever climbs it; an escalator
 * falls smoothly and moves whoever stands on it. Both cover the whole flight,
 * including the stretch under the slab that the deck's own opening does not.
 */
export function accessFlightAreas(platform: PlatformConfig, track: TrackConfig): WalkArea[] {
  return accessLayouts(platform, track).map((layout) => {
    const stairs = layout.kind === AccessKind.STAIRS

    return {
      id: `${layout.id}-flight`,
      ...layout.footprint,
      floorY: layout.deckY,
      slope: {
        fromX: layout.headX,
        descent: layout.descent,
        gradient: layout.rise / layout.run,
        bottomY: layout.landingY,
        tread: stairs ? STAIR_GOING : undefined,
      },
      belt: layout.beltX === 0 ? undefined : { x: layout.beltX, z: 0 },
      pace: stairs ? STAIR_PACE : ESCALATOR_PACE,
    }
  })
}

/**
 * The balustrades around each opening. The hole itself is already missing
 * from the deck, so these only have to keep the player off the handrails.
 */
export function accessObstacles(platform: PlatformConfig, track: TrackConfig): WalkObstacle[] {
  return accessLayouts(platform, track).flatMap((layout) => {
    const { opening, id } = layout
    return [
      {
        id: `${id}-balustrade-near`,
        minX: opening.minX,
        maxX: opening.maxX,
        minZ: opening.minZ - BALUSTRADE_THICKNESS,
        maxZ: opening.minZ,
      },
      {
        id: `${id}-balustrade-far`,
        minX: opening.minX,
        maxX: opening.maxX,
        minZ: opening.maxZ,
        maxZ: opening.maxZ + BALUSTRADE_THICKNESS,
      },
    ]
  })
}

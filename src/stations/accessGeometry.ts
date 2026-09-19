import type { Vec3 } from '../components/InstancedParts'
import { AccessKind, accessForPlatform, type VerticalAccessConfig } from '../data/access'
import type { PlatformConfig, TrackConfig } from '../data/types'
import type { WalkArea, WalkObstacle } from '../systems/walk'
import { boxOver, rectBetweenZ, rectsAround, type Box, type Rect } from './deck'
import { platformLayout } from './geometry'

/**
 * Staircases and escalators, resolved from their config into world geometry.
 *
 * Same split as the rest of the station: this module does the arithmetic and
 * knows nothing about materials, `VerticalAccess` draws it, and `walkable`
 * collides against the very same openings — so the hole the player sees and
 * the hole they can fall down are one hole (PLAN.md §12, §33).
 */

/** Riser and going the step count is fitted to. Close to the DMRC public stair. */
const STAIR_RISER = 0.165
const STAIR_GOING = 0.3

/** Escalators are built to a fixed 30 degrees. */
const ESCALATOR_ANGLE = Math.PI / 6

/** Pitch of the cleats that read as escalator steps. */
const CLEAT_PITCH = 0.4

/** How far a tread block overlaps the one below, so the flight has no slots in it. */
const STEP_OVERLAP = 0.03

/** How far the balustrade runs on past the head of the flight. */
const HEAD_EXTENSION = 0.3

/** Thickness of the balustrade panel standing along each side of a flight. */
export const BALUSTRADE_THICKNESS = 0.09

/** Slop so the shaft walls sit behind the slab rather than fighting with it. */
const SHAFT_MARGIN = 0.35

export interface AccessLayout {
  id: string
  kind: AccessKind
  /** The hole in the deck, in world coordinates. */
  opening: Rect
  deckY: number
  landingY: number
  /** X of the top of the flight, i.e. the lip the player steps off. */
  headX: number
  descent: 1 | -1
  centerZ: number
  halfWidth: number
  /** Rotation about Z that lays an X-aligned part along the flight. */
  slope: number
  /** Centre of the flight on its nosing line, and its length down the slope. */
  flightCenter: Vec3
  flightLength: number
  /** The same, extended past the head where the balustrade overruns. */
  railCenter: Vec3
  railLength: number
  /** Tread blocks of a staircase; empty for an escalator. */
  steps: Vec3[]
  stepSize: Vec3
  /** Step cleats of an escalator; empty for a staircase. */
  cleats: Vec3[]
  /** The unlit box below the deck that the flight descends into. */
  shaft: Box
  /** Guard rail across the far end of the opening, where the flight ducks under. */
  endRailCenter: Vec3
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

  // A box whose long axis is X is laid along the flight by this one rotation.
  // The box is symmetric, so descending towards -X is the same tilt mirrored.
  const pitch = Math.atan2(rise, run)
  const slope = config.descent > 0 ? -pitch : pitch

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

  // Each block hangs from its own nosing and overlaps the one below, so the
  // flight reads as solid rather than as a stack of separated slabs.
  const stepDepth = riser + STEP_OVERLAP
  const steps: Vec3[] = stairs
    ? Array.from({ length: stepCount }, (_, i) => [
        headX + config.descent * (i + 0.5) * STAIR_GOING,
        deckY - (i + 1) * riser - stepDepth / 2,
        centerZ,
      ])
    : []

  const cleatCount = stairs ? 0 : Math.floor(flightLength / CLEAT_PITCH)
  const cleats: Vec3[] = Array.from({ length: cleatCount }, (_, i) => {
    const along = (i + 0.5) * CLEAT_PITCH
    return [
      headX + config.descent * along * Math.cos(pitch),
      deckY - along * Math.sin(pitch),
      centerZ,
    ]
  })

  // The shaft has to reach the toe of the flight, which is further along than
  // the opening; the extra is under the slab and never seen.
  const toeX = headX + config.descent * run
  const shaft = boxOver(
    {
      minX: Math.min(opening.minX, toeX) - SHAFT_MARGIN,
      maxX: Math.max(opening.maxX, toeX) + SHAFT_MARGIN,
      minZ: opening.minZ - SHAFT_MARGIN,
      maxZ: opening.maxZ + SHAFT_MARGIN,
    },
    config.landingY,
    deckY,
  )

  return {
    id: config.id,
    kind: config.kind,
    opening,
    deckY,
    landingY: config.landingY,
    headX,
    descent: config.descent,
    centerZ,
    halfWidth,
    slope,
    flightCenter,
    flightLength,
    railCenter,
    railLength,
    steps,
    stepSize: [STAIR_GOING, stepDepth, config.width],
    cleats,
    shaft,
    endRailCenter: [
      config.descent > 0 ? opening.maxX : opening.minX,
      deckY,
      centerZ,
    ],
  }
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

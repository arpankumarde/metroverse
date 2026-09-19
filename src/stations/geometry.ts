import {
  PlatformSide,
  type PlatformConfig,
  type StationConfig,
  type TrackConfig,
} from '../data/types'

/**
 * World-space layout derived from a StationConfig.
 *
 * One shared convention so the platforms, the tracks and the train all agree
 * without any of them knowing about each other:
 *
 *   +X  direction of travel
 *   +Y  up, with y = 0 at the top of the rails
 *   +Z  the right-hand side of the track, looking along +X
 *
 * A station is built around its own origin, and placed on the line by a group
 * transform at its chainage; everything in here is therefore station-local,
 * and the same platform drawn at two stations is drawn identically.
 */

/** Half a car width (1.45 m) plus the statutory platform gap. */
export const PLATFORM_EDGE_OFFSET = 1.55

/** Width of the yellow tactile warning strip along the platform edge. */
export const TACTILE_STRIP_WIDTH = 0.6

/** Rail cross-section, in metres. */
export const RAIL_WIDTH = 0.072
export const RAIL_HEIGHT = 0.172

/** Concrete sleeper cross-section, in metres. */
export const SLEEPER_LENGTH = 2.6
export const SLEEPER_WIDTH = 0.25
export const SLEEPER_HEIGHT = 0.2

/** Trackbed slab under the sleepers. Must stay inside the track spacing so
 *  neighbouring roads do not overlap and z-fight. */
export const TRACKBED_WIDTH = 3.8
export const TRACKBED_THICKNESS = 0.4

/** The permanent-way stack, measured down from rail top at y = 0. */
export const SLEEPER_TOP_Y = -RAIL_HEIGHT
export const SLEEPER_CENTER_Y = SLEEPER_TOP_Y - SLEEPER_HEIGHT / 2
export const TRACKBED_TOP_Y = SLEEPER_TOP_Y - SLEEPER_HEIGHT
export const TRACKBED_CENTER_Y = TRACKBED_TOP_Y - TRACKBED_THICKNESS / 2

/** Floor of the track slab. Platforms are drawn down to here so they read as solid. */
export const TRACK_BASE_Y = TRACKBED_TOP_Y - TRACKBED_THICKNESS

export interface PlatformLayout {
  /** +1 when the platform is on the +Z side of its track, -1 when on -Z. */
  sideSign: 1 | -1
  /** Z of the platform edge facing the track. */
  edgeZ: number
  /** Z of the platform centre, where the deck slab is drawn. */
  centerZ: number
  /** Y of the platform deck surface, i.e. what a passenger stands on. */
  deckY: number
}

export function sleeperCount(track: TrackConfig, length: number): number {
  return Math.floor(length / track.sleeperSpacing)
}

export function trackById(tracks: readonly TrackConfig[], trackId: string): TrackConfig {
  const track = tracks.find((candidate) => candidate.id === trackId)
  if (!track) throw new Error(`No running line ${trackId} on this corridor`)
  return track
}

export function platformForTrack(station: StationConfig, trackId: string): PlatformConfig {
  const platform = station.platforms.find((candidate) => candidate.trackId === trackId)
  if (!platform) throw new Error(`Station ${station.id} has no platform serving ${trackId}`)
  return platform
}

export function platformLayout(platform: PlatformConfig, track: TrackConfig): PlatformLayout {
  const sideSign = platform.side === PlatformSide.RIGHT ? 1 : -1

  return {
    sideSign,
    edgeZ: track.offset + sideSign * PLATFORM_EDGE_OFFSET,
    centerZ: track.offset + sideSign * (PLATFORM_EDGE_OFFSET + platform.width / 2),
    deckY: platform.height,
  }
}

/**
 * How far the station reaches either side of its centreline, measured to the
 * outer edge of its furthest platform. The structure carrying it has to be at
 * least this wide.
 */
export function stationHalfWidth(
  station: StationConfig,
  tracks: readonly TrackConfig[],
): number {
  return station.platforms.reduce((widest, platform) => {
    const { edgeZ, sideSign } = platformLayout(platform, trackById(tracks, platform.trackId))
    return Math.max(widest, Math.abs(edgeZ + sideSign * platform.width))
  }, 0)
}

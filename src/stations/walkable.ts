import type { StationConfig, TrackConfig } from '../data/types'
import type { WalkArea, WalkObstacle, WalkVolume } from '../systems/walk'
import { accessObstacles, platformDeckAreas } from './accessGeometry'
import { platformFittings } from './fittings'
import { trackById } from './geometry'

/**
 * The floor of a station as the walking system sees it (PLAN.md §12).
 *
 * A platform deck is walkable everywhere except where a stair or escalator
 * opening has been cut out of it, so the deck's own edges are what stop the
 * player: they cannot step off into the track well, into the side of a
 * berthed train, off the back of the platform, or down a stairwell. The
 * benches, bins, sign posts, edge railing and balustrades standing on the
 * deck punch further holes out of it, taken from the same modules the meshes
 * are drawn from.
 *
 * All of it derives from the StationConfig, so a new station needs no change
 * here — only its chainage, which shifts the whole floor along the line to
 * wherever that station stands.
 */
export function stationWalkVolume(
  station: StationConfig,
  tracks: readonly TrackConfig[],
  x = 0,
): WalkVolume {
  const areas: WalkArea[] = []
  const obstacles: WalkObstacle[] = []

  for (const platform of station.platforms) {
    const track = trackById(tracks, platform.trackId)

    areas.push(...platformDeckAreas(platform, track).map((area) => along(area, x)))
    obstacles.push(
      ...platformFittings(platform, track).obstacles.map((obstacle) => along(obstacle, x)),
      ...accessObstacles(platform, track).map((obstacle) => along(obstacle, x)),
    )
  }

  return { areas, obstacles }
}

/** The same rectangle, moved from station-local X on to the line. */
function along<T extends { minX: number; maxX: number }>(rect: T, x: number): T {
  return x === 0 ? rect : { ...rect, minX: rect.minX + x, maxX: rect.maxX + x }
}

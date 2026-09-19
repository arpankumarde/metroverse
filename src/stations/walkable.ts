import type { StationConfig, TrackConfig } from '../data/types'
import type { WalkArea, WalkObstacle, WalkVolume } from '../systems/walk'
import { accessObstacles, platformDeckAreas } from './accessGeometry'
import { concourseAreas, concourseObstacles, stationFlightAreas } from './concourseGeometry'
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
 * What is in those openings is walkable too, and is the way down: each flight
 * is a floor of its own that starts level with the deck and falls to the
 * concourse, where a hall floor takes over. The three are stacked, not
 * joined — a person standing on the deck is over the flight's lower reaches
 * and never on it, because the walk only counts floors within a step of the
 * height they are standing at.
 *
 * All of it derives from the StationConfig, so a new station needs no change
 * here — only its chainage, which shifts the whole floor along the line to
 * wherever that station stands.
 *
 * `piers` are the chainages of the viaduct's piers. They come up through the
 * concourse, and the station has no way of knowing where they are.
 */
export function stationWalkVolume(
  station: StationConfig,
  tracks: readonly TrackConfig[],
  x = 0,
  piers: readonly number[] = [],
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

  areas.push(
    ...stationFlightAreas(station, tracks).map((area) => along(area, x)),
    ...concourseAreas(station, tracks).map((area) => along(area, x)),
  )

  // Worked out from the chainages in station-local plan, like everything above.
  obstacles.push(...concourseObstacles(station, tracks, x, piers).map((obstacle) => along(obstacle, x)))

  return { areas, obstacles }
}

/**
 * The same rectangle, moved from station-local X on to the line. A sloped floor
 * measures its slope from its own head, which has to move with it.
 */
function along<T extends { minX: number; maxX: number; slope?: WalkArea['slope'] }>(
  rect: T,
  x: number,
): T {
  if (x === 0) return rect

  const moved = { ...rect, minX: rect.minX + x, maxX: rect.maxX + x }
  if (rect.slope) moved.slope = { ...rect.slope, fromX: rect.slope.fromX + x }
  return moved
}

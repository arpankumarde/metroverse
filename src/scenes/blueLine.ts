import type { PlayerSpawn } from '../components/FirstPersonPlayer'
import { BLUE_CORRIDOR } from '../data/corridor'
import { DMRC_STANDARD_GAUGE } from '../data/rollingStock'
import { BLUE_LINE_SERVICE } from '../data/service'
import type { CorridorStation } from '../data/types'
import { platformForTrack, platformLayout, trackById } from '../stations/geometry'
import { stationWalkVolume } from '../stations/walkable'
import { createLineService, serviceWalkVolume } from '../train/lineService'
import { mergeVolumes } from '../systems/walk'

/**
 * The built stretch of the Blue Line, ready to be walked around and ridden.
 *
 * The service is made here rather than inside the scene because more than the
 * renderer needs it: the floor the player may stand on is the platforms of
 * every station plus the saloon of every train, and that has to exist before
 * anything is drawn (PLAN.md §12).
 */

/** Every road of the corridor, worked and already running (PLAN.md §7). */
export const SERVICE = createLineService(
  BLUE_CORRIDOR,
  BLUE_LINE_SERVICE,
  DMRC_STANDARD_GAUGE,
)

/**
 * Where the player starts. The line is six kilometres long and only the
 * station they are standing at is in sight of them, so `?station=mandi_house`
 * puts them at another one — the whole line is built, and this is how the
 * rest of it is reached before riding a train there is possible.
 */
function startingStation(): CorridorStation {
  const first = BLUE_CORRIDOR.stations[0]
  if (!first) throw new Error('The Blue Line corridor has no stations')

  const asked = new URLSearchParams(window.location.search).get('station')
  return BLUE_CORRIDOR.stations.find(({ station }) => station.id === asked) ?? first
}

const START = startingStation()

/** The Noida-bound road, whose platform the player starts on. */
const FACING_TRACK = trackById(BLUE_CORRIDOR.tracks, 'blue-r2')
const FACING_PLATFORM = platformForTrack(START.station, FACING_TRACK.id)

/** How far back from the platform edge the player starts. */
const STANDOFF = 2.65

/** How far along the platform, from its centre towards the Dwarka end. */
const ALONG_PLATFORM = 55

const { edgeZ, sideSign } = platformLayout(FACING_PLATFORM, FACING_TRACK)

/**
 * The player starts standing on the Noida-bound platform, part way along it,
 * turned to look across the running lines and away down the line the trains
 * come from. Boarding from here is a ride east, station by station, towards
 * the far end of the built corridor (PLAN.md §31).
 */
export const SPAWN: PlayerSpawn = {
  x: START.x - ALONG_PLATFORM,
  z: edgeZ + sideSign * STANDOFF,
  yaw: -0.55,
}

/**
 * Everywhere the player is allowed to stand: the platforms of every station
 * on the corridor, and the floor of every train working it. Walking out of a
 * doorway on to a platform, or in through one, needs no mode of its own —
 * it is one floor giving way to another (PLAN.md §12).
 */
export const WALK_VOLUME = mergeVolumes(
  ...BLUE_CORRIDOR.stations.map(({ station, x }) =>
    stationWalkVolume(station, BLUE_CORRIDOR.tracks, x),
  ),
  serviceWalkVolume(SERVICE),
)

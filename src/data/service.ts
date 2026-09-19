import type { ServiceConfig } from './types'

/**
 * How the Blue Line is worked.
 *
 * Roughly DMRC practice: trains come on to the platform at about 65 km/h, are
 * braked at a comfortable service rate rather than an emergency one, and stand
 * for a little under half a minute — the corridor is centred on Rajiv Chowk,
 * the busiest interchange on the network, so its dwells are long.
 *
 * The headway is the interval between successive workings, which with a run
 * of about ten and a half minutes end to end puts eight trains on each road
 * at once. It is a little tighter than the real timetable: a genuine
 * four-minute peak headway would leave a platform empty for most of the time
 * the player is standing on it.
 */
export const BLUE_LINE_SERVICE: ServiceConfig = {
  lineSpeed: 18,
  acceleration: 1.1,
  braking: 1.3,
  arrivingSpeed: 5,
  stopPause: 1.8,
  doorTravel: 2.2,
  dwell: 18,
  departPause: 2,
  headway: 100,
}

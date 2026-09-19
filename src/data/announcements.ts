import type { BilingualName, MetroLine, StationConfig } from './types'

/**
 * Platform announcements (PLAN.md §17, §20).
 *
 * Deliberately a lookup of pure functions rather than strings baked into the
 * audio code, so a station can later override a line here — or a Hindi track
 * can be added alongside — without touching the player. In-train announcements
 * ("Next station, Mandi House") will add their own script beside this one.
 *
 * Nothing here decides *when* to speak. The station's public address system
 * watches the train state machine and picks the key; these functions only put
 * the words together (PLAN.md §16).
 */
export interface AnnouncementContext {
  station: StationConfig
  line: MetroLine
  /** Public-facing platform number, as printed on the platform sign. */
  platformNumber: string
  /** Where the train at this platform is headed. */
  destination: BilingualName
  /** Seconds until that train is standing at the platform. */
  waitSeconds: number
}

export const AnnouncementKey = {
  /** Which train is coming to this platform, and how long it will be. */
  NEXT_TRAIN: 'NEXT_TRAIN',
  /** That train is now running in and can be seen from the platform. */
  APPROACHING: 'APPROACHING',
  DOORS_OPEN: 'DOORS_OPEN',
  DOORS_CLOSING: 'DOORS_CLOSING',
} as const

export type AnnouncementKey = (typeof AnnouncementKey)[keyof typeof AnnouncementKey]

/**
 * The wait, said the way a station says it rather than to the second.
 *
 * A board counts down exactly; a voice rounds, because by the time the
 * sentence has finished an exact figure is already wrong.
 */
export function spokenWait(seconds: number): string {
  if (seconds >= 90) return `in ${Math.round(seconds / 60)} minutes`
  if (seconds >= 55) return 'in about a minute'
  if (seconds >= 15) return `in about ${Math.round(seconds / 5) * 5} seconds`
  return 'shortly'
}

type Script = Record<AnnouncementKey, (ctx: AnnouncementContext) => string>

const ENGLISH: Script = {
  NEXT_TRAIN: ({ line, destination, platformNumber, waitSeconds }) =>
    `Attention please. The next ${line.name.en} train towards ${destination.en} will arrive at platform ${platformNumber} ${spokenWait(waitSeconds)}.`,
  APPROACHING: ({ destination, platformNumber }) =>
    `The train now approaching platform ${platformNumber} is towards ${destination.en}. Please stand behind the yellow line.`,
  DOORS_OPEN: ({ station }) =>
    `This is ${station.name.en}. Please allow the passengers to exit before boarding. Mind the gap.`,
  DOORS_CLOSING: ({ destination }) =>
    `The doors are closing. This train is towards ${destination.en}. Please stand clear of the doors.`,
}

export function announcementText(key: AnnouncementKey, ctx: AnnouncementContext): string {
  return ENGLISH[key](ctx)
}

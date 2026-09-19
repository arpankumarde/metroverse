import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AnnouncementKey,
  announcementText,
  type AnnouncementContext,
} from '../data/announcements'
import type { CorridorConfig, MetroLine, PlatformConfig, StationConfig } from '../data/types'
import { openPA, speak } from '../audio/pa'
import { callAt } from '../train/line'
import { secondsToArrival, trainAtCall } from '../train/predict'
import { useRoads, type Road } from '../train/roads'
import { TrainState } from '../train/service'
import { raiseAnnouncement } from '../ui/announcements'
import { platformLayout, trackById } from './geometry'

/**
 * The public address system of the line (PLAN.md §8 step 5, §17).
 *
 * It announces nothing on a timetable of its own. It watches the train state
 * machine for every platform on the corridor and speaks on the transitions a
 * passenger standing there would be told about — so the voice, the
 * destination board and the train itself can never disagree, because all
 * three are reading the same trains (PLAN.md §16).
 *
 * Only one platform is ever audible: the one the player is actually standing
 * on. Six stations working two roads each would otherwise be a dozen voices
 * talking over one another. Walking down to the other platform, or riding on
 * to the next station, changes which one that is, and the new platform opens
 * by telling the player what is coming.
 */

/** The announcement a platform makes when its train enters each state. */
const ON_ENTERING: Partial<Record<TrainState, AnnouncementKey>> = {
  [TrainState.BRAKING]: AnnouncementKey.APPROACHING,
  [TrainState.DOORS_OPEN]: AnnouncementKey.DOORS_OPEN,
  [TrainState.DOORS_CLOSING]: AnnouncementKey.DOORS_CLOSING,
}

/** How far along the line from a station's centre it can still be heard. */
const WITHIN_STATION = 120

interface Served {
  station: StationConfig
  /** Where the station is on the line, in world X. */
  x: number
  platform: PlatformConfig
  trackId: string
  /** Z of the platform centre, for working out which one the player is on. */
  centerZ: number
}

interface PlatformAnnouncementsProps {
  corridor: CorridorConfig
  line: MetroLine
}

export function PlatformAnnouncements({ corridor, line }: PlatformAnnouncementsProps) {
  const roads = useRoads()
  const camera = useThree((state) => state.camera)

  const served = useMemo<Served[]>(
    () =>
      corridor.stations.flatMap(({ station, x }) =>
        station.platforms.map((platform) => {
          const track = trackById(corridor.tracks, platform.trackId)
          return {
            station,
            x,
            platform,
            trackId: track.id,
            centerZ: platformLayout(platform, track).centerZ,
          }
        }),
      ),
    [corridor],
  )

  /** Which call each platform is on its road, worked out once. */
  const calls = useMemo(() => {
    const index = new Map<string, number>()
    if (!roads) return index

    for (const where of served) {
      const road = roads.get(where.trackId)
      if (road) index.set(where.platform.id, callAt(road.schedule, where.station.id))
    }
    return index
  }, [roads, served])

  /** Last state seen on each platform's train, for spotting the transitions. */
  const seen = useRef(new Map<string, TrainState | null>())

  /** The platform whose "next train" notice has already been given. */
  const greeted = useRef<string | null>(null)

  useEffect(openPA, [])

  useFrame(() => {
    if (!roads) return

    const announce = (key: AnnouncementKey, where: Served, road: Road, call: number) => {
      const context: AnnouncementContext = {
        station: where.station,
        line,
        platformNumber: where.platform.number,
        destination: where.platform.towards,
        waitSeconds: secondsToArrival(road, call),
      }

      const text = announcementText(key, context)
      raiseAnnouncement(where.platform.number, text)
      speak(text)
    }

    // The platform the player is standing on is the one they can hear: the
    // station they are at, and then the platform of it they are on.
    let audible: Served | null = null
    let nearest = Number.POSITIVE_INFINITY

    for (const where of served) {
      const along = Math.abs(camera.position.x - where.x)
      if (along > WITHIN_STATION) continue

      const across = Math.abs(camera.position.z - where.centerZ)
      const distance = along + across
      if (distance < nearest) {
        nearest = distance
        audible = where
      }
    }

    if (audible && greeted.current !== audible.platform.id) {
      const road = roads.get(audible.trackId)
      const call = calls.get(audible.platform.id) ?? -1

      if (road && call >= 0) {
        greeted.current = audible.platform.id
        announce(AnnouncementKey.NEXT_TRAIN, audible, road, call)
      }
    }

    for (const where of served) {
      const road = roads.get(where.trackId)
      const call = calls.get(where.platform.id) ?? -1
      if (!road || call < 0) continue

      const before = seen.current.get(where.platform.id)
      const now = trainAtCall(road, call)?.state ?? null
      if (before === now) continue

      // Every platform is tracked, whether or not it can be heard, so walking
      // on to one mid-cycle does not mistake its state for a transition.
      seen.current.set(where.platform.id, now)
      if (before === undefined || where !== audible) continue

      // A platform whose train has just pulled out moves on to the next one.
      const key = now === null ? AnnouncementKey.NEXT_TRAIN : ON_ENTERING[now]
      if (key) announce(key, where, road, call)
    }
  })

  return null
}

import type { MetroLine, StationConfig, TrackConfig } from '../data/types'
import { Canopy } from './Canopy'
import { Furniture } from './Furniture'
import { Platform } from './Platform'
import { Signage } from './Signage'
import { VerticalAccess } from './VerticalAccess'
import { TRACK_BASE_Y, trackById } from './geometry'

interface StationProps {
  station: StationConfig
  /** The corridor's running lines, which the platforms are laid out against. */
  tracks: readonly TrackConfig[]
  /** Drives the colour of every sign in the station (PLAN.md §10). */
  line: MetroLine
}

/**
 * A station, assembled entirely from its StationConfig. Adding a station is a
 * data edit in `src/data/corridor.ts`; this component never learns any station
 * names (PLAN.md §9, §33).
 *
 * Platforms, the barrel-vault canopy, platform furniture and signage — the
 * whole of PLAN.md §8 bar the passengers, which are their own system. The
 * running lines are not here: they belong to the corridor, because they carry
 * on through to the next station.
 *
 * Everything is drawn about the station's own origin, so the station is put on
 * the line by the single group transform its caller wraps it in.
 */
export function Station({ station, tracks, line }: StationProps) {
  return (
    <group name={station.id}>
      {station.platforms.map((platform) => {
        const track = trackById(tracks, platform.trackId)
        return (
          <group key={platform.id}>
            <Platform platform={platform} track={track} />
            <VerticalAccess platform={platform} track={track} line={line} />
            <Furniture platform={platform} track={track} />
            <Signage station={station} platform={platform} track={track} line={line} />
          </group>
        )
      })}

      {/* The vault springs from outside the platforms, so its columns stand
          on the structural deck rather than on the platform decks. */}
      <Canopy canopy={station.canopy} baseY={TRACK_BASE_Y} />
    </group>
  )
}

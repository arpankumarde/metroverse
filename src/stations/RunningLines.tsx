import { useMemo } from 'react'
import { NearCamera } from '../components/NearCamera'
import { alignmentSections } from '../data/alignment'
import { corridorEnd, corridorStart } from '../data/corridor'
import type { CorridorConfig, VerticalAlignment } from '../data/types'
import { Track } from './Track'

/**
 * The permanent way of the whole corridor: both running lines, continuous
 * from one end of the built line to the other.
 *
 * The line belongs here rather than to any station because it runs through
 * all of them — that continuity is what a train works along (PLAN.md §7).
 *
 * It also rises and falls with the corridor's alignment, which is what puts
 * the rails on the floor of the tunnel rather than hanging in the air above
 * it. Lengths are cut short where the line is on a ramp, so the eased grade
 * comes out as a curve rather than as a row of facets (PLAN.md §6).
 */

/** Length of one drawn section of line, level and on a ramp, in metres. */
const SECTION = 220
const RAMP_SECTION = 40

interface RunningLinesProps {
  corridor: CorridorConfig
  alignment: VerticalAlignment
}

export function RunningLines({ corridor, alignment }: RunningLinesProps) {
  const cut = useMemo(
    () =>
      alignmentSections(alignment, corridorStart(corridor), corridorEnd(corridor), {
        level: SECTION,
        graded: RAMP_SECTION,
      }),
    [alignment, corridor],
  )

  return (
    <group name={`${corridor.id}-way`}>
      {cut.map((section) => (
        <NearCamera
          key={section.from}
          x={(section.from + section.to) / 2}
          reach={(section.to - section.from) / 2}
        >
          {corridor.tracks.map((track) => (
            <Track
              key={track.id}
              track={track}
              from={section.from}
              to={section.to}
              fromY={section.fromY}
              toY={section.toY}
            />
          ))}
        </NearCamera>
      ))}
    </group>
  )
}

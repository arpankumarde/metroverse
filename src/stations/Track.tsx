import { useMemo } from 'react'
import { InstancedParts, type Vec3 } from '../components/InstancedParts'
import type { TrackConfig } from '../data/types'
import {
  RAIL_HEIGHT,
  RAIL_WIDTH,
  SLEEPER_CENTER_Y,
  SLEEPER_HEIGHT,
  SLEEPER_LENGTH,
  SLEEPER_WIDTH,
  TRACKBED_CENTER_Y,
  TRACKBED_THICKNESS,
  TRACKBED_WIDTH,
  sleeperCount,
} from './geometry'

interface TrackProps {
  track: TrackConfig
  /** The stretch of line drawn, in world X. */
  from: number
  to: number
  /** Rail top at each end, so the length lies on the grade (PLAN.md §6). */
  fromY?: number
  toY?: number
}

/**
 * A length of one running line: trackbed slab, sleepers and two rails, laid
 * between two points along the corridor.
 *
 * The line is drawn in lengths rather than in one piece so that each of them
 * can be culled on its own; sleeper pitch is worked out per length so the
 * joins between them are not visible (PLAN.md §28).
 *
 * A length is straight, and the grade it is laid on is a curve, so on a ramp
 * the caller cuts short lengths and gives each one the height of its own two
 * ends. Everything inside is then built along the length's own X, which is
 * the slope rather than the map — a length cut to its horizontal distance
 * would come up short and leave a gap at every rail joint on a ramp.
 */
export function Track({ track, from, to, fromY = 0, toY = 0 }: TrackProps) {
  const runX = to - from
  const runY = toY - fromY
  const length = Math.hypot(runX, runY)
  const slope = Math.atan2(runY, runX)
  const count = sleeperCount(track, length)

  const sleepers = useMemo<Vec3[]>(() => {
    const pitch = length / count
    return Array.from(
      { length: count },
      (_, i) => [-length / 2 + (i + 0.5) * pitch, SLEEPER_CENTER_Y, 0] as Vec3,
    )
  }, [count, length])

  const railZ = track.gauge / 2

  return (
    <group
      position={[(from + to) / 2, (fromY + toY) / 2, track.offset]}
      rotation={[0, 0, slope]}
      name={`${track.id}-${from}`}
    >
      <mesh position={[0, TRACKBED_CENTER_Y, 0]} receiveShadow>
        <boxGeometry args={[length, TRACKBED_THICKNESS, TRACKBED_WIDTH]} />
        <meshStandardMaterial color="#5c5c5e" roughness={0.95} />
      </mesh>

      <InstancedParts positions={sleepers}>
        <boxGeometry args={[SLEEPER_WIDTH, SLEEPER_HEIGHT, SLEEPER_LENGTH]} />
        <meshStandardMaterial color="#77776f" roughness={0.9} />
      </InstancedParts>

      {[railZ, -railZ].map((z) => (
        <mesh key={z} position={[0, -RAIL_HEIGHT / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[length, RAIL_HEIGHT, RAIL_WIDTH]} />
          <meshStandardMaterial color="#9aa0a7" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

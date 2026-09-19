import { useMemo } from 'react'
import { InstancedParts } from '../components/InstancedParts'
import type { PlatformConfig, TrackConfig } from '../data/types'
import {
  BENCH_BACK,
  BENCH_LEG,
  BENCH_SEAT,
  BIN_HEIGHT,
  BIN_RADIUS,
  RAIL_HEIGHT_ABOVE_DECK,
  RAIL_POST_SECTION,
  RAIL_SECTION,
  UPSTAND_HEIGHT,
  UPSTAND_THICKNESS,
  platformFittings,
} from './fittings'

/**
 * What stands on the deck: benches, bins and the railing along the outer
 * edge (PLAN.md §8).
 *
 * Every repeated part is one InstancedMesh across the platform, so the whole
 * furnishing set costs a handful of draw calls however long the platform is.
 * Placement comes from `fittings`, which the walking system reads too.
 */

const STEEL_COLOR = '#9aa1a8'
const BENCH_COLOR = '#b9bec4'
const RAILING_COLOR = '#1f5fa8'
const UPSTAND_COLOR = '#aaa69c'
const BIN_COLOR = '#3f4a52'

interface FurnitureProps {
  platform: PlatformConfig
  track: TrackConfig
}

export function Furniture({ platform, track }: FurnitureProps) {
  const fittings = useMemo(() => platformFittings(platform, track), [platform, track])
  const { deckY, upstandZ } = fittings

  return (
    <group name={`${platform.id}-furniture`}>
      <InstancedParts positions={fittings.benchSeats}>
        <boxGeometry args={BENCH_SEAT} />
        <meshStandardMaterial color={BENCH_COLOR} roughness={0.35} metalness={0.7} />
      </InstancedParts>

      <InstancedParts positions={fittings.benchBacks}>
        <boxGeometry args={BENCH_BACK} />
        <meshStandardMaterial color={BENCH_COLOR} roughness={0.35} metalness={0.7} />
      </InstancedParts>

      <InstancedParts positions={fittings.benchLegs}>
        <boxGeometry args={BENCH_LEG} />
        <meshStandardMaterial color={STEEL_COLOR} roughness={0.45} metalness={0.6} />
      </InstancedParts>

      <InstancedParts positions={fittings.bins}>
        <cylinderGeometry args={[BIN_RADIUS, BIN_RADIUS * 0.85, BIN_HEIGHT, 12]} />
        <meshStandardMaterial color={BIN_COLOR} roughness={0.6} metalness={0.3} />
      </InstancedParts>

      <mesh position={[0, deckY + UPSTAND_HEIGHT / 2, upstandZ]} castShadow receiveShadow>
        <boxGeometry args={[platform.length, UPSTAND_HEIGHT, UPSTAND_THICKNESS]} />
        <meshStandardMaterial color={UPSTAND_COLOR} roughness={0.9} />
      </mesh>

      <InstancedParts positions={fittings.railPosts}>
        <boxGeometry args={[RAIL_POST_SECTION, fittings.railPostHeight, RAIL_POST_SECTION]} />
        <meshStandardMaterial color={RAILING_COLOR} roughness={0.45} metalness={0.35} />
      </InstancedParts>

      {[RAIL_HEIGHT_ABOVE_DECK, (RAIL_HEIGHT_ABOVE_DECK + UPSTAND_HEIGHT) / 2].map((y) => (
        <mesh key={y} position={[0, deckY + y, upstandZ]} castShadow>
          <boxGeometry args={[platform.length, RAIL_SECTION, RAIL_SECTION]} />
          <meshStandardMaterial color={RAILING_COLOR} roughness={0.45} metalness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

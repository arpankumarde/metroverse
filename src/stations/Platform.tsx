import type { PlatformConfig, TrackConfig } from '../data/types'
import { platformDeckRects } from './accessGeometry'
import { boxOver } from './deck'
import { TACTILE_STRIP_WIDTH, TRACK_BASE_Y, platformLayout } from './geometry'

/** Inlays are raised a hair off the deck so they never z-fight with the slab. */
const INLAY_LIFT = 0.006
const INLAY_THICKNESS = 0.02

/** Dark nosing capping the platform edge, as cast into the DMRC coping slab. */
const NOSING_WIDTH = 0.12

/** Polished granite band running the length of the deck, behind the tactile strip. */
const BAND_WIDTH = 0.34
const BAND_SETBACK = 3.4

const DECK_COLOR = '#9ea49f'
const SLAB_COLOR = '#b0aca2'
const TACTILE_COLOR = '#e0a41d'
const NOSING_COLOR = '#4b4f52'
const BAND_COLOR = '#6f7a72'

interface PlatformProps {
  platform: PlatformConfig
  track: TrackConfig
}

/**
 * A side platform: the structural slab, the polished deck laid over it, the
 * yellow tactile warning strip and the edge nosing (PLAN.md §8).
 *
 * The slab runs all the way down to the track base rather than floating at
 * deck height, so seen from track level it reads as a solid wall of concrete.
 *
 * It is drawn as the set of rectangles left over once the stair and escalator
 * openings are taken out, which is the same set the player may walk on — so
 * the hole underfoot and the hole on screen are one hole (PLAN.md §12).
 */
export function Platform({ platform, track }: PlatformProps) {
  const { length } = platform
  const { edgeZ, deckY, sideSign } = platformLayout(platform, track)

  const deckRects = platformDeckRects(platform, track)

  // Laid out from the track-side edge inwards, in the platform's own direction.
  const nosingZ = edgeZ + sideSign * (NOSING_WIDTH / 2)
  const tactileZ = edgeZ + sideSign * (NOSING_WIDTH + TACTILE_STRIP_WIDTH / 2)
  const bandZ = edgeZ + sideSign * BAND_SETBACK

  return (
    <group name={platform.id}>
      {deckRects.map((rect) => {
        const slab = boxOver(rect, TRACK_BASE_Y, deckY)
        const finish = boxOver(rect, deckY, deckY + INLAY_LIFT)

        return (
          <group key={`${rect.minX}:${rect.minZ}`}>
            <mesh position={slab.position} receiveShadow castShadow>
              <boxGeometry args={slab.size} />
              <meshStandardMaterial color={SLAB_COLOR} roughness={0.92} />
            </mesh>

            {/* Polished deck finish, slightly proud of the structural slab. */}
            <mesh position={finish.position} receiveShadow>
              <boxGeometry args={finish.size} />
              <meshStandardMaterial color={DECK_COLOR} roughness={0.32} metalness={0.05} />
            </mesh>
          </group>
        )
      })}

      <mesh position={[0, deckY + INLAY_LIFT, nosingZ]} receiveShadow>
        <boxGeometry args={[length, INLAY_THICKNESS, NOSING_WIDTH]} />
        <meshStandardMaterial color={NOSING_COLOR} roughness={0.55} />
      </mesh>

      <mesh position={[0, deckY + INLAY_LIFT, tactileZ]} receiveShadow>
        <boxGeometry args={[length, INLAY_THICKNESS, TACTILE_STRIP_WIDTH]} />
        <meshStandardMaterial color={TACTILE_COLOR} roughness={0.7} />
      </mesh>

      <mesh position={[0, deckY + INLAY_LIFT, bandZ]} receiveShadow>
        <boxGeometry args={[length, INLAY_THICKNESS, BAND_WIDTH]} />
        <meshStandardMaterial color={BAND_COLOR} roughness={0.3} metalness={0.05} />
      </mesh>
    </group>
  )
}

import { useMemo, type ReactNode } from 'react'
import type { CanvasTexture } from 'three'
import type {
  CanopyConfig,
  MetroLine,
  PlatformConfig,
  StationConfig,
  TrackConfig,
} from '../data/types'
import { archPoint, archUForZ } from './canopyGeometry'
import {
  NAME_BOARD,
  NAME_BOARD_CENTER_Y,
  NAME_POST_OFFSET,
  NAME_POST_RADIUS,
  platformFittings,
} from './fittings'
import { platformLayout } from './geometry'
import {
  exitSignTexture,
  platformNumberTexture,
  stationNameTexture,
} from './signTexture'
import { useDestinationBoard } from './useDestinationBoard'

/**
 * Platform signage (PLAN.md §8), positioned from the platform's own layout so
 * it follows the deck wherever the data puts it.
 *
 * Three kinds, all taken from `references/`: station name boards on posts
 * facing the track, which is what a passenger reads through the window; the
 * suspended amber destination board with its platform number plate; and the
 * yellow exit gantry over the middle of the platform.
 */

const FRAME_COLOR = '#2b3036'
const POST_COLOR = '#8d939a'
const ROD_COLOR = '#454b50'

const DESTINATION_BOARD: [number, number] = [4.4, 1.375]
const DESTINATION_CENTER_Y = 4.35
const DESTINATION_SETBACK = 2.8
/** Fraction of the platform length out from the centre. */
const DESTINATION_BOARD_AT = 0.233

const PLATFORM_PLATE = 0.62
const PLATE_DROP = 0.72

const EXIT_BOARD: [number, number] = [3.2, 0.8]
const EXIT_CENTER_Y = 4.2
const EXIT_SETBACK = 5.6
const EXIT_SIGN_AT = 0.1

const ROD_RADIUS = 0.028
const ROD_INSET = 0.4

interface PanelProps {
  texture: CanvasTexture
  width: number
  height: number
  /** Backlit signs glow a little; painted ones do not. */
  glow?: number
}

/** A sign face in its frame, facing local +Z. */
function SignPanel({ texture, width, height, glow = 0 }: PanelProps) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[width + 0.07, height + 0.07, 0.08]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} metalness={0.4} />
      </mesh>

      <mesh position={[0, 0, 0.046]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={glow > 0 ? texture : null}
          emissive={glow > 0 ? '#ffffff' : '#000000'}
          emissiveIntensity={glow}
          roughness={0.5}
        />
      </mesh>
    </group>
  )
}

interface HangingSignProps extends PanelProps {
  canopy: CanopyConfig
  x: number
  z: number
  centerY: number
  /** +1 to face along the track, -1 to face back down it. */
  facing: 1 | -1
  children?: ReactNode
}

/** A sign slung from the vault on two rods, reading across the platform. */
function HangingSign({
  canopy,
  x,
  z,
  centerY,
  facing,
  width,
  height,
  texture,
  glow,
  children,
}: HangingSignProps) {
  const topY = centerY + height / 2
  const rodZ = [z - (width / 2 - ROD_INSET), z + (width / 2 - ROD_INSET)]

  return (
    <group>
      <group position={[x, centerY, z]} rotation={[0, (facing * Math.PI) / 2, 0]}>
        <SignPanel texture={texture} width={width} height={height} glow={glow} />
        {children}
      </group>

      {rodZ.map((rz) => {
        const anchorY = archPoint(canopy, archUForZ(canopy, rz), canopy.ribRadius * 2).y
        const length = Math.max(0.2, anchorY - topY)
        return (
          <mesh key={rz} position={[x, topY + length / 2, rz]}>
            <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, length, 6]} />
            <meshStandardMaterial color={ROD_COLOR} roughness={0.5} metalness={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

interface SignageProps {
  station: StationConfig
  platform: PlatformConfig
  track: TrackConfig
  line: MetroLine
}

export function Signage({ station, platform, track, line }: SignageProps) {
  const { canopy } = station
  const { edgeZ, sideSign } = platformLayout(platform, track)
  const fittings = useMemo(() => platformFittings(platform, track), [platform, track])

  const nameTexture = stationNameTexture(station.name, line.color)
  const destinationTexture = useDestinationBoard(platform.towards, track.id, station.id)
  const plateTexture = platformNumberTexture(platform.number, line.color)
  const exitTexture = exitSignTexture()

  const destinationZ = edgeZ + sideSign * DESTINATION_SETBACK
  const exitZ = edgeZ + sideSign * EXIT_SETBACK

  // Faces the track, whichever side of it this platform is on.
  const nameFacingY = sideSign === 1 ? Math.PI : 0
  const postHeight = NAME_BOARD_CENTER_Y + NAME_BOARD[1] / 2 - fittings.deckY

  return (
    <group name={`${platform.id}-signage`}>
      {fittings.nameBoardX.map((x) => (
        <group key={x} position={[x, 0, fittings.nameBoardZ]} rotation={[0, nameFacingY, 0]}>
          <group position={[0, NAME_BOARD_CENTER_Y, 0]}>
            <SignPanel texture={nameTexture} width={NAME_BOARD[0]} height={NAME_BOARD[1]} />
          </group>

          {[NAME_POST_OFFSET, -NAME_POST_OFFSET].map((offset) => (
            <mesh key={offset} position={[offset, fittings.deckY + postHeight / 2, 0]} castShadow>
              <cylinderGeometry args={[NAME_POST_RADIUS, NAME_POST_RADIUS, postHeight, 8]} />
              <meshStandardMaterial color={POST_COLOR} roughness={0.4} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}

      {([1, -1] as const).map((facing) => (
        <HangingSign
          key={`destination-${facing}`}
          canopy={canopy}
          x={-facing * platform.length * DESTINATION_BOARD_AT}
          z={destinationZ}
          centerY={DESTINATION_CENTER_Y}
          facing={facing}
          texture={destinationTexture}
          width={DESTINATION_BOARD[0]}
          height={DESTINATION_BOARD[1]}
          glow={1.15}
        >
          <group position={[0, -(DESTINATION_BOARD[1] / 2 + PLATE_DROP), 0]}>
            <SignPanel texture={plateTexture} width={PLATFORM_PLATE} height={PLATFORM_PLATE} />
            <mesh position={[0, PLATFORM_PLATE / 2 + 0.2, 0]}>
              <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, 0.42, 6]} />
              <meshStandardMaterial color={ROD_COLOR} roughness={0.5} metalness={0.6} />
            </mesh>
          </group>
        </HangingSign>
      ))}

      {([1, -1] as const).map((facing) => (
        <HangingSign
          key={`exit-${facing}`}
          canopy={canopy}
          x={facing * platform.length * EXIT_SIGN_AT}
          z={exitZ}
          centerY={EXIT_CENTER_Y}
          facing={facing}
          texture={exitTexture}
          width={EXIT_BOARD[0]}
          height={EXIT_BOARD[1]}
          glow={0.35}
        />
      ))}
    </group>
  )
}

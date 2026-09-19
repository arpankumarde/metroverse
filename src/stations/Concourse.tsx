import { useMemo } from 'react'
import { InstancedParts } from '../components/InstancedParts'
import type { MetroLine, StationConfig, TrackConfig } from '../data/types'
import { concourseLayout, type DirectionSign } from './concourseGeometry'
import { platformDirectionTexture } from './signTexture'

/**
 * The concourse under a station's platforms (PLAN.md §8, §11): the hall the
 * staircases and escalators land in, and where a passenger crosses from one
 * platform to the other.
 *
 * It is a floor, four walls and a ceiling that is the underside of the viaduct
 * deck, lit by panels set into it. The flights come down through that ceiling
 * and are drawn by `VerticalAccess`; this is only the room.
 *
 * The daylight cannot reach in — the deck shades it from the sun and the walls
 * shut out the sky — so the lighting is the panels in the ceiling, which are
 * self-lit meshes rather than lights. That is deliberate: a real light in every
 * concourse of a six-station line would change the scene's light count each
 * time the camera left one behind, and every material would be rebuilt for it
 * (PLAN.md §28).
 */

const SLAB_COLOR = '#8c8e8b'
const FLOOR_COLOR = '#c4c1b8'
const WALL_COLOR = '#d8d5cb'
const CEILING_COLOR = '#e4e1d8'
const PANEL_COLOR = '#fff4d8'
const FRAME_COLOR = '#2b3036'
const ROD_COLOR = '#454b50'

/** The line-coloured band along the walls, as on a DMRC concourse. */
const BAND_BOTTOM = 1.05
const BAND_HEIGHT = 0.22
const BAND_LIFT = 0.006

const SIGN_SIZE: [number, number] = [3.6, 0.9]
const ROD_RADIUS = 0.028

interface ConcourseProps {
  station: StationConfig
  /** The corridor's running lines, which the platforms are laid out against. */
  tracks: readonly TrackConfig[]
  line: MetroLine
}

interface SignProps {
  sign: DirectionSign
  station: StationConfig
  line: MetroLine
  ceilingY: number
}

/** A board hung from the ceiling on two rods, facing out into the hall. */
function HangingBoard({ sign, station, line, ceilingY }: SignProps) {
  const platform = station.platforms.find((candidate) => candidate.id === sign.platformId)
  const texture = useMemo(
    () => (platform ? platformDirectionTexture(platform.number, platform.towards, line.color) : null),
    [line.color, platform],
  )
  if (!platform || !texture) return null

  const [x, y, z] = sign.position
  const [width, height] = SIGN_SIZE
  const rodLength = ceilingY - (y + height / 2)

  return (
    <group position={[x, y, z]} rotation={[0, sign.facing, 0]}>
      <mesh castShadow>
        <boxGeometry args={[width + 0.07, height + 0.07, 0.08]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} metalness={0.4} />
      </mesh>

      <mesh position={[0, 0, 0.046]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={1}
          roughness={0.5}
        />
      </mesh>

      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 - 0.4), (height + rodLength) / 2, 0]}>
          <cylinderGeometry args={[ROD_RADIUS, ROD_RADIUS, rodLength, 6]} />
          <meshStandardMaterial color={ROD_COLOR} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

export function Concourse({ station, tracks, line }: ConcourseProps) {
  const layout = useMemo(() => concourseLayout(station, tracks), [station, tracks])
  const { hall, floorY, ceilingY } = layout

  // Thin bands proud of each inner wall face: two along the track, two across.
  const bandY = floorY + BAND_BOTTOM + BAND_HEIGHT / 2
  const bands = useMemo(
    () => [
      {
        position: [(hall.minX + hall.maxX) / 2, bandY, hall.minZ + BAND_LIFT / 2] as const,
        size: [hall.maxX - hall.minX, BAND_HEIGHT, BAND_LIFT] as const,
      },
      {
        position: [(hall.minX + hall.maxX) / 2, bandY, hall.maxZ - BAND_LIFT / 2] as const,
        size: [hall.maxX - hall.minX, BAND_HEIGHT, BAND_LIFT] as const,
      },
      {
        position: [hall.minX + BAND_LIFT / 2, bandY, (hall.minZ + hall.maxZ) / 2] as const,
        size: [BAND_LIFT, BAND_HEIGHT, hall.maxZ - hall.minZ] as const,
      },
      {
        position: [hall.maxX - BAND_LIFT / 2, bandY, (hall.minZ + hall.maxZ) / 2] as const,
        size: [BAND_LIFT, BAND_HEIGHT, hall.maxZ - hall.minZ] as const,
      },
    ],
    [bandY, hall],
  )

  return (
    <group name={`${station.id}-concourse`}>
      <mesh position={layout.slab.position} receiveShadow castShadow>
        <boxGeometry args={layout.slab.size} />
        <meshStandardMaterial color={SLAB_COLOR} roughness={0.95} />
      </mesh>

      <mesh position={layout.finish.position} receiveShadow>
        <boxGeometry args={layout.finish.size} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.3} metalness={0.05} />
      </mesh>

      {layout.walls.map((wall) => (
        <mesh key={wall.position.join(':')} position={wall.position} receiveShadow castShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
        </mesh>
      ))}

      {layout.ceiling.map((tile) => (
        <mesh key={tile.position.join(':')} position={tile.position} receiveShadow>
          <boxGeometry args={tile.size} />
          <meshStandardMaterial color={CEILING_COLOR} emissive="#4a4842" roughness={0.9} />
        </mesh>
      ))}

      {bands.map((band) => (
        <mesh key={band.position.join(':')} position={band.position}>
          <boxGeometry args={band.size} />
          <meshStandardMaterial color={line.color} roughness={0.5} />
        </mesh>
      ))}

      <InstancedParts positions={layout.lights} castShadow={false} receiveShadow={false}>
        <boxGeometry args={layout.lightSize} />
        <meshBasicMaterial color={PANEL_COLOR} toneMapped={false} />
      </InstancedParts>

      {layout.signs.map((sign) => (
        <HangingBoard
          key={sign.platformId}
          sign={sign}
          station={station}
          line={line}
          ceilingY={ceilingY}
        />
      ))}
    </group>
  )
}

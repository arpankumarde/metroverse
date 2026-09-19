import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { InstancedPanels, type Panel, type Vec3 } from '../components/InstancedParts'
import { LandmarkKind, type Landmark as LandmarkConfig } from '../data/city'
import { GROUND_Y } from './Daylight'
import { PLOT_Z } from './cityBlock'
import { landmarkSignTexture } from './facadeTexture'

/**
 * A building that is actually there, with its name on the front (PLAN.md §19).
 *
 * The difference between a corridor that feels like Delhi and one that feels
 * like a procedural city is entirely in these. Anonymous frontage is what the
 * eye slides over; the thing that makes a player believe they are on the
 * Blue Line is reading "Punjab National Bank" out of a window at Barakhamba
 * Road, where there is one.
 *
 * What each of them is, and where, is `data/city.ts`. Nothing about any
 * particular building is decided here (PLAN.md §33).
 */

/** Storey height, matching the procedural frontage around it. */
const STOREY = 3.3

/** How proud of the wall the lettering sits. */
const SIGN_PROUD = 0.09

const GLASS_COLOR = '#41535f'

/** Where the name goes: over the door for a shopfront, up top for a tower. */
function signHeight(landmark: LandmarkConfig): number {
  const shopfront =
    landmark.kind === LandmarkKind.BANK ||
    landmark.kind === LandmarkKind.MALL ||
    landmark.kind === LandmarkKind.HOTEL

  return shopfront
    ? Math.min(landmark.height - 1.6, 5.4)
    : Math.max(landmark.height - 4.2, landmark.height * 0.6)
}

interface LandmarkProps {
  landmark: LandmarkConfig
}

export function Landmark({ landmark }: LandmarkProps) {
  const { side, width, depth, height, wall, fascia } = landmark
  const setback = landmark.setback ?? 2

  /** Z of the wall that faces the railway, and of the middle of the mass. */
  const frontZ = side * (PLOT_Z + setback)
  const centerZ = side * (PLOT_Z + setback + depth / 2)
  const base = GROUND_Y

  const signY = base + signHeight(landmark)
  const signWidth = Math.min(width * 0.78, 28)
  const signTall = signWidth / 4

  const texture = useMemo(
    () => landmarkSignTexture(landmark.name, landmark.hi, fascia, landmark.ink ?? '#ffffff'),
    [fascia, landmark.hi, landmark.ink, landmark.name],
  )

  /** Mass, parapet and the band the name is lettered on: one draw call. */
  const shell = useMemo<Panel[]>(() => {
    const panels: Panel[] = [
      {
        position: [landmark.x, base + height / 2, centerZ],
        size: [width, height, depth],
        color: wall,
      },
      {
        position: [landmark.x, base + height + 0.4, centerZ],
        size: [width + 0.4, 0.8, depth + 0.4],
        color: wall,
      },
      // The house-colour band the lettering is mounted on, run right across
      // the frontage — which is what a bank branch actually looks like.
      {
        position: [landmark.x, signY, frontZ - side * 0.1],
        size: [width, signTall + 0.5, 0.42],
        color: fascia,
      },
    ]

    // A deeper, lower podium under the tall ones, so they meet the ground.
    if (height > 26) {
      panels.push({
        position: [landmark.x, base + 2.6, side * (PLOT_Z + setback + depth / 2 - 1)],
        size: [width + 3, 5.2, depth + 2],
        color: wall,
      })
    }

    return panels
  }, [base, centerZ, depth, fascia, frontZ, height, landmark.x, setback, side, signTall, signY, wall, width])

  const glazing = useMemo<Panel[]>(() => {
    const panels: Panel[] = []
    const storeys = Math.max(1, Math.floor(height / STOREY))

    for (let storey = 0; storey < storeys; storey++) {
      const sill = base + storey * STOREY + 1.2
      if (sill + 1.4 > base + height - 0.5) break
      // Leave the band the name is on clear of glass.
      if (Math.abs(sill + 0.7 - signY) < signTall) continue

      panels.push({
        position: [landmark.x, sill + 0.7, centerZ],
        size: [width + 0.16, 1.4, depth + 0.16],
        color: GLASS_COLOR,
      })
    }

    return panels
  }, [base, centerZ, depth, height, landmark.x, signTall, signY, width])

  const signPosition: Vec3 = [landmark.x, signY, frontZ - side * (0.21 + SIGN_PROUD)]

  return (
    <group name={`landmark-${landmark.id}`}>
      <InstancedPanels panels={shell} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </InstancedPanels>

      <InstancedPanels panels={glazing} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" roughness={0.22} metalness={0.35} />
      </InstancedPanels>

      <mesh position={signPosition} rotation={[0, side === 1 ? Math.PI : 0, 0]}>
        <planeGeometry args={[signWidth, signTall]} />
        <meshStandardMaterial map={texture} side={DoubleSide} roughness={0.75} />
      </mesh>
    </group>
  )
}

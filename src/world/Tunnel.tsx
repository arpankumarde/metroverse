import { useMemo } from 'react'
import { NearCamera } from '../components/NearCamera'
import { InstancedPanels, type Panel, type Vec3 } from '../components/InstancedParts'
import { alignmentSections, railPitch, railY } from '../data/alignment'
import type { CorridorConfig, VerticalAlignment } from '../data/types'
import {
  BAY_LENGTH,
  BORE_HALF_WIDTH,
  BOX_HALF_WIDTH,
  BOX_TOP_Y,
  CABLE_TRAY_DEPTH,
  CABLE_TRAY_Y,
  HEADWALL_PARAPET,
  HEADWALL_THICKNESS,
  INVERT_THICKNESS,
  INVERT_TOP_Y,
  LIGHT_LENGTH,
  LIGHT_SPACING,
  LIGHT_Y,
  RING_GRADED,
  RING_LEVEL,
  ROOF_THICKNESS,
  SOFFIT_Y,
  WALKWAY_TOP_Y,
  WALKWAY_WIDTH,
  WALL_THICKNESS,
  isPortal,
  tunnelStretches,
} from './tunnelGeometry'

/**
 * The tunnel the line runs in where it has gone under the street.
 *
 * This is the other half of PLAN.md §6: the window does not go blank when the
 * train leaves the viaduct, it fills with a wall a metre and a half away,
 * ripping past at line speed with the lights strobing along it. That wall is
 * the single best thing in the game for reading speed off, because on the
 * viaduct the nearest thing to the glass is a hundred metres away.
 *
 * Where the tunnel is is not written down here. The corridor's alignment says
 * where the rails are, and the bore is wherever the rails have dropped far
 * enough for the street to be overhead — so the portals cannot drift away
 * from the ramps that lead into them (PLAN.md §33).
 */

const WALL_COLOR = '#8d887f'
const WALKWAY_COLOR = '#5e5b55'
const TRAY_COLOR = '#3b3d40'
const HEADWALL_COLOR = '#9b978d'

/** Sodium-ish tunnel lighting, as strips rather than as lights (PLAN.md §28). */
const LIGHT_COLOR = '#fff4dd'
const LIGHT_EMISSIVE = '#ffe6ae'
const LIGHT_INTENSITY = 2.4

/**
 * A point in a tilted ring, in world space.
 *
 * The whole cross-section is rotated with the grade rather than kept upright,
 * which keeps the box sealed where it bends — at a 5% ruling gradient the
 * three degrees of cant it introduces is not a thing anybody can see.
 */
function place(cx: number, cy: number, pitch: number, y: number, z: number): Vec3 {
  return [cx - Math.sin(pitch) * y, cy + Math.cos(pitch) * y, z]
}

interface Ring {
  centerX: number
  centerY: number
  pitch: number
  length: number
}

function rings(alignment: VerticalAlignment, from: number, to: number): Ring[] {
  return alignmentSections(alignment, from, to, {
    level: RING_LEVEL,
    graded: RING_GRADED,
  }).map((section) => {
    const runX = section.to - section.from
    const runY = section.toY - section.fromY

    return {
      centerX: (section.from + section.to) / 2,
      centerY: (section.fromY + section.toY) / 2,
      pitch: Math.atan2(runY, runX),
      // Along the slope, not along the map: a ring cut to its horizontal
      // length would leave a gap at every joint on a ramp.
      length: Math.hypot(runX, runY),
    }
  })
}

const WALL_HEIGHT = SOFFIT_Y - INVERT_TOP_Y
const WALL_CENTER_Y = (SOFFIT_Y + INVERT_TOP_Y) / 2
const WALL_CENTER_Z = BORE_HALF_WIDTH + WALL_THICKNESS / 2
const WALKWAY_HEIGHT = WALKWAY_TOP_Y - INVERT_TOP_Y

interface BayProps {
  alignment: VerticalAlignment
  from: number
  to: number
}

/**
 * One cullable length of bore.
 *
 * Every piece of the structure is a box, so the whole shell of a bay — both
 * walls, the roof slab and the invert — is one instanced draw, and the
 * fittings inside it are one more (PLAN.md §28).
 */
function TunnelBay({ alignment, from, to }: BayProps) {
  const built = useMemo(() => rings(alignment, from, to), [alignment, from, to])

  const shell = useMemo<Panel[]>(() => {
    const panels: Panel[] = []

    for (const { centerX, centerY, pitch, length } of built) {
      for (const side of [1, -1]) {
        panels.push({
          position: place(centerX, centerY, pitch, WALL_CENTER_Y, side * WALL_CENTER_Z),
          size: [length, WALL_HEIGHT, WALL_THICKNESS],
        })
      }

      panels.push({
        position: place(centerX, centerY, pitch, SOFFIT_Y + ROOF_THICKNESS / 2, 0),
        size: [length, ROOF_THICKNESS, BOX_HALF_WIDTH * 2],
      })

      panels.push({
        position: place(centerX, centerY, pitch, INVERT_TOP_Y - INVERT_THICKNESS / 2, 0),
        size: [length, INVERT_THICKNESS, BOX_HALF_WIDTH * 2],
      })
    }

    return panels
  }, [built])

  const walkways = useMemo<Panel[]>(
    () =>
      built.flatMap(({ centerX, centerY, pitch, length }) =>
        [1, -1].map((side) => ({
          position: place(
            centerX,
            centerY,
            pitch,
            WALKWAY_TOP_Y - WALKWAY_HEIGHT / 2,
            side * (BORE_HALF_WIDTH - WALKWAY_WIDTH / 2),
          ),
          size: [length, WALKWAY_HEIGHT, WALKWAY_WIDTH] as Vec3,
        })),
      ),
    [built],
  )

  const trays = useMemo<Panel[]>(
    () =>
      built.flatMap(({ centerX, centerY, pitch, length }) =>
        [1, -1].map((side) => ({
          position: place(
            centerX,
            centerY,
            pitch,
            CABLE_TRAY_Y,
            side * (BORE_HALF_WIDTH - CABLE_TRAY_DEPTH / 2),
          ),
          size: [length, 0.2, CABLE_TRAY_DEPTH] as Vec3,
        })),
      ),
    [built],
  )

  const rotations = useMemo<Vec3[]>(
    () => built.flatMap(({ pitch }) => Array.from({ length: 4 }, () => [0, 0, pitch] as Vec3)),
    [built],
  )

  const fittingRotations = useMemo<Vec3[]>(
    () => built.flatMap(({ pitch }) => [[0, 0, pitch] as Vec3, [0, 0, pitch] as Vec3]),
    [built],
  )

  /** Strip lights march along the bore at their own pitch, not the rings'. */
  const lights = useMemo<Panel[]>(() => {
    const panels: Panel[] = []
    const count = Math.max(1, Math.round((to - from) / LIGHT_SPACING))
    const pitchAlong = (to - from) / count

    for (let i = 0; i < count; i++) {
      const x = from + (i + 0.5) * pitchAlong
      const y = railY(alignment, x)
      const pitch = railPitch(alignment, x)

      for (const side of [1, -1]) {
        panels.push({
          position: place(x, y, pitch, LIGHT_Y, side * (BORE_HALF_WIDTH - 0.1)),
          size: [LIGHT_LENGTH, 0.18, 0.12],
        })
      }
    }

    return panels
  }, [alignment, from, to])

  return (
    <group name={`bore-${Math.round(from)}`}>
      <InstancedPanels panels={shell} rotations={rotations} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.95} />
      </InstancedPanels>

      <InstancedPanels panels={walkways} rotations={fittingRotations} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color={WALKWAY_COLOR} roughness={0.96} />
      </InstancedPanels>

      <InstancedPanels panels={trays} rotations={fittingRotations} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color={TRAY_COLOR} roughness={0.8} metalness={0.3} />
      </InstancedPanels>

      <InstancedPanels panels={lights} castShadow={false} receiveShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={LIGHT_COLOR}
          emissive={LIGHT_EMISSIVE}
          emissiveIntensity={LIGHT_INTENSITY}
          roughness={0.4}
          toneMapped={false}
        />
      </InstancedPanels>
    </group>
  )
}

interface HeadwallProps {
  /** Chainage of the mouth, and which way the bore runs away from it. */
  x: number
  into: 1 | -1
  alignment: VerticalAlignment
  /** Half the width of the viaduct the tunnel takes over from. */
  halfWidth: number
  groundY: number
}

/**
 * The portal: a wall across the full width of the formation with the bore
 * cut through it.
 *
 * It is what makes a tunnel mouth read as a mouth. It also covers the step
 * from the 24 m viaduct deck down to the 12 m box, which without it would be
 * a structure that visibly changes width in mid-air.
 */
function Headwall({ x, into, alignment, halfWidth, groundY }: HeadwallProps) {
  const railTop = railY(alignment, x)
  const top = railTop + BOX_TOP_Y + HEADWALL_PARAPET
  const face = x - into * (HEADWALL_THICKNESS / 2)

  const cheekWidth = halfWidth - BOX_HALF_WIDTH
  const lintelBottom = railTop + SOFFIT_Y
  const lintelHeight = top - lintelBottom

  return (
    <group name={`portal-${Math.round(x)}`}>
      {cheekWidth > 0.2 &&
        [1, -1].map((side) => (
          <mesh
            key={side}
            position={[
              face,
              (groundY + top) / 2,
              side * (BOX_HALF_WIDTH + cheekWidth / 2),
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[HEADWALL_THICKNESS, top - groundY, cheekWidth]} />
            <meshStandardMaterial color={HEADWALL_COLOR} roughness={0.94} />
          </mesh>
        ))}

      <mesh position={[face, lintelBottom + lintelHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[HEADWALL_THICKNESS, lintelHeight, BOX_HALF_WIDTH * 2]} />
        <meshStandardMaterial color={HEADWALL_COLOR} roughness={0.94} />
      </mesh>
    </group>
  )
}

interface TunnelProps {
  corridor: CorridorConfig
  alignment: VerticalAlignment
  /** Half the width of the viaduct, so the portals can close off the step. */
  halfWidth: number
  groundY: number
}

export function Tunnel({ corridor, alignment, halfWidth, groundY }: TunnelProps) {
  const stretches = useMemo(
    () => tunnelStretches(corridor, alignment),
    [alignment, corridor],
  )

  return (
    <group name={`${corridor.id}-tunnels`}>
      {stretches.map((stretch) => {
        const bays = Math.max(1, Math.round((stretch.to - stretch.from) / BAY_LENGTH))
        const pitch = (stretch.to - stretch.from) / bays

        return (
          <group key={stretch.from}>
            {Array.from({ length: bays }, (_, i) => {
              const from = stretch.from + i * pitch
              const to = i === bays - 1 ? stretch.to : from + pitch

              return (
                <NearCamera key={from} x={(from + to) / 2} reach={(to - from) / 2}>
                  <TunnelBay alignment={alignment} from={from} to={to} />
                </NearCamera>
              )
            })}

            {isPortal(corridor, stretch.from) && (
              <NearCamera x={stretch.from} reach={HEADWALL_THICKNESS}>
                <Headwall
                  x={stretch.from}
                  into={1}
                  alignment={alignment}
                  halfWidth={halfWidth}
                  groundY={groundY}
                />
              </NearCamera>
            )}

            {isPortal(corridor, stretch.to) && (
              <NearCamera x={stretch.to} reach={HEADWALL_THICKNESS}>
                <Headwall
                  x={stretch.to}
                  into={-1}
                  alignment={alignment}
                  halfWidth={halfWidth}
                  groundY={groundY}
                />
              </NearCamera>
            )}
          </group>
        )
      })}
    </group>
  )
}

import { useMemo } from 'react'
import { InstancedPanels, InstancedParts } from '../components/InstancedParts'
import type { MetroLine, RollingStockConfig } from '../data/types'
import { saloonLayout } from './saloonGeometry'

/**
 * Interior finish, from `references/metro inside/`: ivory FRP panels, a paler
 * ceiling, a dark vinyl floor with a sheen on it, and stainless everything
 * you can hold on to.
 */
const LINING_COLOR = '#eee7d8'
const FLOOR_COLOR = '#6d6459'
const SILL_COLOR = '#d8b21f'
const SEAT_COLOR = '#b9bec4'
const STAINLESS_COLOR = '#c6cbd0'
const HANDLE_COLOR = '#1d1f22'
const STRAP_COLOR = '#2a2c30'
const GANGWAY_COLOR = '#2a2b2e'

/** Warm fluorescent, as on the standard-gauge stock. */
const LIGHT_COLOR = '#fff4dd'
const LIGHT_EMISSIVE = '#ffe6ac'

/**
 * The saloon is a closed box under a roof that shadows it, so almost none of
 * the daylight outside reaches in and the whole interior would read as a
 * cave. Real coaches are lit, brightly, by the strips along the ceiling — but
 * an emissive strip lights nothing but itself, and the scene's lighting
 * budget is three static sources for the whole world (PLAN.md §28).
 *
 * So the bounce is painted on: interior finishes carry a little emissive of
 * their own, warm and strongest on the panels nearest the strips. It is the
 * standard cheat, and it is what makes the inside of the train look lit
 * rather than merely pale.
 */
const LIT_PANEL = '#6b5f48'
const LIT_PANEL_STRENGTH = 0.75
const LIT_FLOOR = '#38302a'
const LIT_FLOOR_STRENGTH = 0.8
const LIT_SEAT = '#2b3036'
const LIT_SEAT_STRENGTH = 0.7

/** Cylinders are built about +Y; this lays a grab rail along the car. */
const RAIL_ROTATION = [0, 0, Math.PI / 2] as const

interface SaloonProps {
  stock: RollingStockConfig
  /** Drives the wall band and the route displays, so line identity reaches
   *  inside the train as well as outside it (PLAN.md §10). */
  line: MetroLine
}

/**
 * The inside of the train: the part of the simulator the player is actually
 * in (PLAN.md §4, §5).
 *
 * Every repeated fitting is one InstancedMesh across all eight cars — the
 * benches, the poles, the rails, the hundreds of grab handles — so a fully
 * furnished saloon costs about a dozen draw calls on top of the shell
 * (PLAN.md §28).
 *
 * Nothing in here casts a shadow. The car body already casts one over the
 * whole saloon, so interior shadow casting would buy nothing but shadow-map
 * fill; what does reach in is the sun through the glazing, which the floor and
 * the seats receive.
 */
export function Saloon({ stock, line }: SaloonProps) {
  const layout = useMemo(() => saloonLayout(stock), [stock])
  const { poleRadius, handleRadius } = stock.saloon

  return (
    <group name="saloon">
      <InstancedPanels panels={layout.shell} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={LINING_COLOR}
          emissive={LIT_PANEL}
          emissiveIntensity={LIT_PANEL_STRENGTH}
          roughness={0.85}
        />
      </InstancedPanels>

      <InstancedPanels panels={layout.floors} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={FLOOR_COLOR}
          emissive={LIT_FLOOR}
          emissiveIntensity={LIT_FLOOR_STRENGTH}
          roughness={0.45}
          metalness={0.05}
        />
      </InstancedPanels>

      <InstancedPanels panels={layout.sills} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color={SILL_COLOR} roughness={0.6} />
      </InstancedPanels>

      <InstancedPanels panels={layout.bands} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color={line.color} roughness={0.55} />
      </InstancedPanels>

      <InstancedPanels panels={layout.seats} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={SEAT_COLOR}
          emissive={LIT_SEAT}
          emissiveIntensity={LIT_SEAT_STRENGTH}
          roughness={0.3}
          metalness={0.35}
        />
      </InstancedPanels>

      {/* The saloon is a closed box the sun barely reaches, so the light
          strips are emissive rather than lit: they read as the light source
          without costing the scene a fourth shadow-casting lamp (PLAN.md §28). */}
      <InstancedPanels panels={layout.lights} castShadow={false} receiveShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={LIGHT_COLOR}
          emissive={LIGHT_EMISSIVE}
          emissiveIntensity={2.4}
          roughness={0.4}
        />
      </InstancedPanels>

      <InstancedPanels panels={layout.displays} castShadow={false} receiveShadow={false}>
        <boxGeometry />
        <meshStandardMaterial
          color={line.color}
          emissive={line.color}
          emissiveIntensity={0.45}
          roughness={0.5}
        />
      </InstancedPanels>

      <InstancedPanels panels={layout.gangways} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color={GANGWAY_COLOR} roughness={0.95} />
      </InstancedPanels>

      <InstancedParts positions={layout.poles} castShadow={false}>
        <cylinderGeometry args={[poleRadius, poleRadius, layout.poleHeight, 10]} />
        <meshStandardMaterial color={STAINLESS_COLOR} roughness={0.25} metalness={0.55} />
      </InstancedParts>

      <InstancedParts positions={layout.rails} rotation={RAIL_ROTATION} castShadow={false}>
        <cylinderGeometry args={[poleRadius, poleRadius, layout.railLength, 8]} />
        <meshStandardMaterial color={STAINLESS_COLOR} roughness={0.25} metalness={0.55} />
      </InstancedParts>

      <InstancedParts positions={layout.droppers} castShadow={false}>
        <cylinderGeometry args={[poleRadius * 0.7, poleRadius * 0.7, layout.dropperHeight, 6]} />
        <meshStandardMaterial color={STAINLESS_COLOR} roughness={0.25} metalness={0.55} />
      </InstancedParts>

      <InstancedPanels panels={layout.straps} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color={STRAP_COLOR} roughness={0.7} />
      </InstancedPanels>

      <InstancedParts positions={layout.handles} castShadow={false}>
        <torusGeometry args={[handleRadius, 0.016, 5, 9]} />
        <meshStandardMaterial color={HANDLE_COLOR} roughness={0.6} />
      </InstancedParts>
    </group>
  )
}

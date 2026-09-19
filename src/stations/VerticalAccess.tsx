import { useMemo } from 'react'
import { BackSide } from 'three'
import { InstancedParts, type Vec3 } from '../components/InstancedParts'
import { AccessKind } from '../data/access'
import type { MetroLine, PlatformConfig, TrackConfig } from '../data/types'
import { BALUSTRADE_THICKNESS, accessLayouts, type AccessLayout } from './accessGeometry'

/**
 * The staircases and escalators dropping off a platform (PLAN.md §8, §12).
 *
 * What sells a stairwell from standing height is not the flight — most of it
 * is under the deck — but the balustrades and handrails rising out of the
 * hole, so those are the parts that get the detail. Everything below the deck
 * descends into an unlit shaft standing in for the concourse, which is not
 * modelled yet.
 */

const SHAFT_COLOR = '#4d5257'
const TREAD_COLOR = '#b3afa6'
const STEEL_COLOR = '#a8aeb4'
const POST_COLOR = '#8d939a'
const TRUSS_COLOR = '#697076'
const ESCALATOR_STEP_COLOR = '#9aa1a7'
const CLEAT_COLOR = '#787f85'
const GLASS_COLOR = '#cfe0ea'
const RUBBER_COLOR = '#23272b'
const COMB_COLOR = '#c9a227'

/** Balustrade panel: plumb sides, top edge raking with the flight. */
const PANEL_HEIGHT = 1.02
const PANEL_LIFT = 0.42

/** Handrail height above the nosing line, measured vertically as built. */
const HANDRAIL_HEIGHT = 0.95
const HANDRAIL_RADIUS = 0.028
const HANDRAIL_SEGMENTS = 8

/** Guard rail across the end of the opening, where the flight ducks under. */
const END_RAIL_HEIGHT = 1.05
const END_RAIL_SECTION = 0.06
const END_POST_SECTION = 0.05

const TRUSS_DEPTH = 0.55
const ESCALATOR_STEP_DEPTH = 0.18
const CLEAT_SIZE: [number, number] = [0.05, 0.05]
const SKIRT_HEIGHT = 0.26
const COMB_LENGTH = 0.45

interface VerticalAccessProps {
  platform: PlatformConfig
  track: TrackConfig
  /** Handrails and skirt bands carry the line's colour (PLAN.md §10). */
  line: MetroLine
}

/** The unlit box below the deck, seen only down the opening. */
function Shaft({ layout }: { layout: AccessLayout }) {
  return (
    <mesh position={layout.shaft.position}>
      <boxGeometry args={layout.shaft.size} />
      <meshStandardMaterial color={SHAFT_COLOR} roughness={0.95} side={BackSide} />
    </mesh>
  )
}

/** Guard rail across the far end of the opening, with a post at each side. */
function EndRail({ layout }: { layout: AccessLayout }) {
  const [x, deckY, centerZ] = layout.endRailCenter
  const span = layout.halfWidth * 2

  return (
    <>
      <mesh position={[x, deckY + END_RAIL_HEIGHT, centerZ]}>
        <boxGeometry args={[END_RAIL_SECTION, END_RAIL_SECTION, span]} />
        <meshStandardMaterial color={STEEL_COLOR} roughness={0.4} metalness={0.6} />
      </mesh>

      <InstancedParts
        positions={[
          [x, deckY + END_RAIL_HEIGHT / 2, centerZ - layout.halfWidth],
          [x, deckY + END_RAIL_HEIGHT / 2, centerZ + layout.halfWidth],
        ]}
      >
        <boxGeometry args={[END_POST_SECTION, END_RAIL_HEIGHT, END_POST_SECTION]} />
        <meshStandardMaterial color={POST_COLOR} roughness={0.45} metalness={0.5} />
      </InstancedParts>
    </>
  )
}

function Staircase({ layout, line }: { layout: AccessLayout; line: MetroLine }) {
  const [railX, railY] = layout.railCenter
  const sides: number[] = [-layout.halfWidth, layout.halfWidth]
  const rake: Vec3 = [0, 0, layout.slope]

  return (
    <group name={layout.id}>
      <Shaft layout={layout} />

      <InstancedParts positions={layout.steps}>
        <boxGeometry args={layout.stepSize} />
        <meshStandardMaterial color={TREAD_COLOR} roughness={0.55} />
      </InstancedParts>

      {/* Solid panel each side, carrying the handrail — the DMRC public stair. */}
      <InstancedParts
        positions={sides.map(
          (side) => [railX, railY + PANEL_LIFT, layout.centerZ + side] as Vec3,
        )}
        rotation={rake}
      >
        <boxGeometry args={[layout.railLength, PANEL_HEIGHT, BALUSTRADE_THICKNESS]} />
        <meshStandardMaterial color={STEEL_COLOR} roughness={0.42} metalness={0.45} />
      </InstancedParts>

      <InstancedParts
        positions={sides.map(
          (side) => [railX, railY + HANDRAIL_HEIGHT, layout.centerZ + side] as Vec3,
        )}
        rotation={[0, 0, layout.slope - Math.PI / 2]}
      >
        <cylinderGeometry
          args={[HANDRAIL_RADIUS, HANDRAIL_RADIUS, layout.railLength, HANDRAIL_SEGMENTS]}
        />
        <meshStandardMaterial color={line.color} roughness={0.35} metalness={0.3} />
      </InstancedParts>

      <EndRail layout={layout} />
    </group>
  )
}

function Escalator({ layout, line }: { layout: AccessLayout; line: MetroLine }) {
  const [flightX, flightY] = layout.flightCenter
  const [railX, railY] = layout.railCenter
  const sides: number[] = [-layout.halfWidth, layout.halfWidth]
  const rake: Vec3 = [0, 0, layout.slope]

  return (
    <group name={layout.id}>
      <Shaft layout={layout} />

      {/* Truss, then the step band riding on top of it. */}
      <mesh position={[flightX, flightY - ESCALATOR_STEP_DEPTH - TRUSS_DEPTH / 2, layout.centerZ]} rotation={rake}>
        <boxGeometry args={[layout.flightLength, TRUSS_DEPTH, layout.halfWidth * 2 - 0.12]} />
        <meshStandardMaterial color={TRUSS_COLOR} roughness={0.6} metalness={0.35} />
      </mesh>

      <mesh
        position={[flightX, flightY - ESCALATOR_STEP_DEPTH / 2, layout.centerZ]}
        rotation={rake}
      >
        <boxGeometry args={[layout.flightLength, ESCALATOR_STEP_DEPTH, layout.halfWidth * 2 - 0.2]} />
        <meshStandardMaterial color={ESCALATOR_STEP_COLOR} roughness={0.45} metalness={0.5} />
      </mesh>

      {/* Cleats across the band, which is what reads as steps from the deck. */}
      <InstancedParts positions={layout.cleats} rotation={rake}>
        <boxGeometry args={[CLEAT_SIZE[0], CLEAT_SIZE[1], layout.halfWidth * 2 - 0.22]} />
        <meshStandardMaterial color={CLEAT_COLOR} roughness={0.4} metalness={0.55} />
      </InstancedParts>

      {/* Skirt band below the balustrade, in the line's colour. */}
      <InstancedParts
        positions={sides.map(
          (side) => [flightX, flightY + SKIRT_HEIGHT / 2, layout.centerZ + side] as Vec3,
        )}
        rotation={rake}
      >
        <boxGeometry args={[layout.flightLength, SKIRT_HEIGHT, BALUSTRADE_THICKNESS]} />
        <meshStandardMaterial color={line.color} roughness={0.4} metalness={0.2} />
      </InstancedParts>

      <InstancedParts
        positions={sides.map(
          (side) => [railX, railY + PANEL_LIFT + SKIRT_HEIGHT, layout.centerZ + side] as Vec3,
        )}
        rotation={rake}
      >
        <boxGeometry args={[layout.railLength, PANEL_HEIGHT, 0.03]} />
        <meshStandardMaterial
          color={GLASS_COLOR}
          roughness={0.08}
          metalness={0.1}
          transparent
          opacity={0.26}
        />
      </InstancedParts>

      <InstancedParts
        positions={sides.map(
          (side) =>
            [railX, railY + PANEL_LIFT + SKIRT_HEIGHT + PANEL_HEIGHT / 2, layout.centerZ + side] as Vec3,
        )}
        rotation={rake}
      >
        <boxGeometry args={[layout.railLength, 0.07, 0.13]} />
        <meshStandardMaterial color={RUBBER_COLOR} roughness={0.85} />
      </InstancedParts>

      {/* Comb plate at the head, level with the deck. */}
      <mesh
        position={[
          layout.headX + layout.descent * (COMB_LENGTH / 2),
          layout.deckY - 0.01,
          layout.centerZ,
        ]}
      >
        <boxGeometry args={[COMB_LENGTH, 0.04, layout.halfWidth * 2]} />
        <meshStandardMaterial color={COMB_COLOR} roughness={0.5} metalness={0.4} />
      </mesh>

      <EndRail layout={layout} />
    </group>
  )
}

export function VerticalAccess({ platform, track, line }: VerticalAccessProps) {
  const layouts = useMemo(() => accessLayouts(platform, track), [platform, track])

  return (
    <group name={`${platform.id}-access`}>
      {layouts.map((layout) =>
        layout.kind === AccessKind.STAIRS ? (
          <Staircase key={layout.id} layout={layout} line={line} />
        ) : (
          <Escalator key={layout.id} layout={layout} line={line} />
        ),
      )}
    </group>
  )
}

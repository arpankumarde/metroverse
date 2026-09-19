import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Object3D } from 'three'
import { DynamicInstances } from '../components/DynamicInstances'
import { InstancedParts, type Vec3 } from '../components/InstancedParts'
import { AccessKind, ESCALATOR_SPEED } from '../data/access'
import type { MetroLine, PlatformConfig, TrackConfig } from '../data/types'
import {
  BALUSTRADE_THICKNESS,
  CLEAT_PITCH,
  accessLayouts,
  type AccessLayout,
} from './accessGeometry'
import { escalatorArrowTexture } from './signTexture'

/**
 * The staircases and escalators dropping off a platform (PLAN.md §8, §12).
 *
 * A flight is a solid body running down from the deck to the concourse floor,
 * with the balustrades and handrails standing on it. What sells a stairwell
 * from standing height is the balustrades rising out of the hole, so those are
 * the parts that get the detail; what sells it from the hall below is that the
 * flight is a real thing coming down through the ceiling, with a body under it
 * you cannot walk into.
 *
 * An escalator is not decoration. Its steps travel at the speed the walking
 * system carries a person at, in the direction it carries them, so what you see
 * moving is what is moving you.
 */

const TREAD_COLOR = '#b3afa6'
const CLADDING_COLOR = '#454b50'
const NOSING_COLOR = '#d9b23a'
const STEEL_COLOR = '#a8aeb4'
const POST_COLOR = '#8d939a'
const ESCALATOR_STEP_COLOR = '#9aa1a7'
const CLEAT_COLOR = '#3b4147'
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

const ESCALATOR_STEP_DEPTH = 0.18
const CLEAT_SIZE: [number, number] = [0.06, 0.04]
const SKIRT_HEIGHT = 0.26
const COMB_LENGTH = 0.45
const ARROW_SIZE = 0.4

interface VerticalAccessProps {
  platform: PlatformConfig
  track: TrackConfig
  /** Handrails and skirt bands carry the line's colour (PLAN.md §10). */
  line: MetroLine
}

/** The solid under a flight, extruded across its width from a side profile. */
function FlightBody({ layout, color }: { layout: AccessLayout; color: string }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    layout.body.forEach(([x, y], index) => {
      if (index === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()

    // Extruded from z = 0 to the flight's width; moved to where the flight is.
    const solid = new ExtrudeGeometry(shape, { depth: layout.halfWidth * 2, bevelEnabled: false })
    solid.translate(0, 0, layout.centerZ - layout.halfWidth)
    return solid
  }, [layout])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.15} />
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
  const rake: Vec3 = [0, 0, layout.tilt]

  return (
    <group name={layout.id}>
      <FlightBody layout={layout} color={TREAD_COLOR} />

      {/* A contrasting nosing on every tread, as on the DMRC public stair. */}
      <InstancedParts positions={layout.nosings}>
        <boxGeometry args={[0.06, 0.012, layout.halfWidth * 2 - 0.02]} />
        <meshStandardMaterial color={NOSING_COLOR} roughness={0.6} />
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
        rotation={[0, 0, layout.tilt - Math.PI / 2]}
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

/**
 * The steps of an escalator: cleats riding round the band, a whole number of
 * them to the length of the flight so the belt is a loop.
 *
 * The phase only advances while the escalator can be seen. Most of the line is
 * hidden behind haze and its escalators have nobody to move, so they stand
 * still and cost nothing until the player is near enough to look at them.
 */
function EscalatorSteps({ layout }: { layout: AccessLayout }) {
  const anchor = useRef<Object3D>(null)
  const phase = useRef(0)

  const forward = Math.sign(layout.beltX) === Math.sign(layout.descent) ? 1 : -1
  const loop = layout.cleatCount

  useFrame((_, delta) => {
    // A step is the belt's whole length in one go otherwise: clamp what a
    // backgrounded tab reports when it comes back.
    const step = Math.min(delta, 0.1)

    for (let node: Object3D | null = anchor.current; node; node = node.parent) {
      if (!node.visible) return
    }

    // Steps per second: incline speed over the pitch of the cleats.
    phase.current = (phase.current + (ESCALATOR_SPEED * step) / CLEAT_PITCH) % loop
  })

  const place = useCallback(
    (transform: Object3D, index: number, value: number) => {
      // Down escalators carry the steps the way the flight descends, up ones back.
      const along = (((index + forward * value) % loop) + loop) % loop
      const distance = (along + 0.5) * CLEAT_PITCH

      transform.position.set(
        layout.headX + layout.descent * distance * Math.cos(layout.pitch),
        layout.deckY - distance * Math.sin(layout.pitch),
        layout.centerZ,
      )
      transform.rotation.set(0, 0, layout.tilt)
    },
    [forward, layout, loop],
  )

  return (
    <group ref={anchor}>
      <DynamicInstances count={loop} driver={phase} place={place}>
        <boxGeometry args={[CLEAT_SIZE[0], CLEAT_SIZE[1], layout.halfWidth * 2 - 0.22]} />
        <meshStandardMaterial color={CLEAT_COLOR} roughness={0.4} metalness={0.55} />
      </DynamicInstances>
    </group>
  )
}

/** A green arrow flat on a comb plate, turned to point the way the steps go. */
function DirectionArrow({ layout, x, y }: { layout: AccessLayout; x: number; y: number }) {
  const texture = useMemo(() => escalatorArrowTexture(), [])
  const direction = Math.sign(layout.beltX)

  return (
    <mesh position={[x, y, layout.centerZ]} rotation={[-Math.PI / 2, 0, (-direction * Math.PI) / 2]}>
      <planeGeometry args={[ARROW_SIZE, ARROW_SIZE]} />
      <meshStandardMaterial
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={0.6}
        roughness={0.5}
      />
    </mesh>
  )
}

function Escalator({ layout, line }: { layout: AccessLayout; line: MetroLine }) {
  const [flightX, flightY] = layout.flightCenter
  const [railX, railY] = layout.railCenter
  const sides: number[] = [-layout.halfWidth, layout.halfWidth]
  const rake: Vec3 = [0, 0, layout.tilt]

  const headComb = layout.headX + layout.descent * (COMB_LENGTH / 2)
  const toeComb = layout.toeX - layout.descent * (COMB_LENGTH / 2)

  return (
    <group name={layout.id}>
      <FlightBody layout={layout} color={CLADDING_COLOR} />

      {/* The step band, with the moving cleats riding on it. */}
      <mesh
        position={[flightX, flightY - ESCALATOR_STEP_DEPTH / 2, layout.centerZ]}
        rotation={rake}
      >
        <boxGeometry args={[layout.flightLength, ESCALATOR_STEP_DEPTH, layout.halfWidth * 2 - 0.2]} />
        <meshStandardMaterial color={ESCALATOR_STEP_COLOR} roughness={0.45} metalness={0.5} />
      </mesh>

      <EscalatorSteps layout={layout} />

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

      {/* Comb plates at either end, level with the floor each lands on. */}
      <InstancedParts
        positions={[
          [headComb, layout.deckY - 0.01, layout.centerZ],
          [toeComb, layout.landingY + 0.03, layout.centerZ],
        ]}
      >
        <boxGeometry args={[COMB_LENGTH, 0.04, layout.halfWidth * 2]} />
        <meshStandardMaterial color={COMB_COLOR} roughness={0.5} metalness={0.4} />
      </InstancedParts>

      <DirectionArrow layout={layout} x={headComb} y={layout.deckY + 0.012} />
      <DirectionArrow layout={layout} x={toeComb} y={layout.landingY + 0.054} />

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

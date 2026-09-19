import { useMemo } from 'react'
import { NearCamera } from '../components/NearCamera'
import { InstancedParts, type Vec3 } from '../components/InstancedParts'
import { alignmentSections, railY, type Stretch } from '../data/alignment'
import type { VerticalAlignment } from '../data/types'
import { TRACK_BASE_Y } from './geometry'

/**
 * The elevated structure the line stands on.
 *
 * Just enough of it to make the platforms read as being in the air rather
 * than floating: the deck the trackbed and platform slabs sit on, an edge
 * beam down each side, and the piers carrying it. It runs the whole length of
 * the corridor, because the line does. The wider view from up here is
 * PLAN.md §19 and belongs to `world/City.tsx`.
 *
 * The deck follows the corridor's alignment down its ramps, so the piers get
 * shorter as the line descends and the structure meets the ground at the
 * portal, where the tunnel takes over. It is not drawn at all where the line
 * is covered — that stretch is a box, not a deck on legs (PLAN.md §6).
 */

const DECK_THICKNESS = 1
const EDGE_BEAM_HEIGHT = 1.5
const EDGE_BEAM_WIDTH = 0.55

/** One pier bay. Spans are cut to a whole number of these (PLAN.md §7). */
export const PIER_SPACING = 27
const PIER_SIZE: [number, number] = [2.4, 1.6]
const PIER_HEAD_HEIGHT = 0.9
const PIER_HEAD_OVERHANG = 0.7

/** Below this a pier is a stub, and the deck is as good as on the ground. */
const MINIMUM_PIER = 0.5

/** Length of one drawn span of deck, level and on a ramp, in metres. */
const SPAN_LEVEL = PIER_SPACING * 4
const SPAN_GRADED = PIER_SPACING * 2

const CONCRETE_COLOR = '#a9a59b'
const BEAM_COLOR = '#9d998f'
const PIER_COLOR = '#9b978d'

/** Rail top is the top of the deck; the deck is what the trackbed sits on. */
export const DECK_TOP_Y = TRACK_BASE_Y
export const DECK_BOTTOM_Y = DECK_TOP_Y - DECK_THICKNESS

/** The parts of a stretch that are not inside any of `covered`, in order. */
function uncovered(from: number, to: number, covered: readonly Stretch[]): Stretch[] {
  const open: Stretch[] = []
  let at = from

  for (const stretch of [...covered].sort((a, b) => a.from - b.from)) {
    if (stretch.from > at) open.push({ from: at, to: Math.min(stretch.from, to) })
    at = Math.max(at, stretch.to)
    if (at >= to) break
  }

  if (at < to) open.push({ from: at, to })

  return open.filter((stretch) => stretch.to - stretch.from > 1)
}

interface SpanProps {
  halfWidth: number
  alignment: VerticalAlignment
  from: number
  to: number
  fromY: number
  toY: number
  groundY: number
}

/** One cullable span of deck, with the piers standing under it. */
function ViaductSpan({ halfWidth, alignment, from, to, fromY, toY, groundY }: SpanProps) {
  const runX = to - from
  const runY = toY - fromY
  const length = Math.hypot(runX, runY)
  const slope = Math.atan2(runY, runX)

  /**
   * Piers are upright whatever the deck is doing, so they are placed in world
   * space rather than inside the tilted span. The near end of a span carries
   * a pier and the far end does not, which is what stops two spans doubling
   * one up at every joint.
   */
  const bays = Math.max(1, Math.round(runX / PIER_SPACING))
  const pierX = useMemo(
    () => Array.from({ length: bays }, (_, i) => from + (i * runX) / bays),
    [bays, from, runX],
  )

  const standing = useMemo(
    () =>
      pierX
        .map((x) => {
          const deckBottom = railY(alignment, x) + DECK_BOTTOM_Y
          const top = deckBottom - PIER_HEAD_HEIGHT
          return { x, deckBottom, top, height: top - groundY }
        })
        .filter((pier) => pier.height > MINIMUM_PIER),
    [alignment, groundY, pierX],
  )

  const pierHeads = useMemo<Vec3[]>(
    () => standing.map((pier) => [pier.x, pier.deckBottom - PIER_HEAD_HEIGHT / 2, 0]),
    [standing],
  )

  const piers = useMemo<Vec3[]>(
    () => standing.map((pier) => [pier.x, groundY + pier.height / 2, 0]),
    [groundY, standing],
  )

  const sizes = useMemo<Vec3[]>(
    () => standing.map((pier) => [1, pier.height, 1]),
    [standing],
  )

  return (
    <group name={`viaduct-${Math.round(from)}`}>
      <group position={[(from + to) / 2, (fromY + toY) / 2, 0]} rotation={[0, 0, slope]}>
        <mesh position={[0, DECK_TOP_Y - DECK_THICKNESS / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[length, DECK_THICKNESS, halfWidth * 2]} />
          <meshStandardMaterial color={CONCRETE_COLOR} roughness={0.95} />
        </mesh>

        {[halfWidth, -halfWidth].map((z) => (
          <mesh
            key={z}
            position={[
              0,
              DECK_TOP_Y - EDGE_BEAM_HEIGHT / 2,
              z - Math.sign(z) * (EDGE_BEAM_WIDTH / 2),
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[length, EDGE_BEAM_HEIGHT, EDGE_BEAM_WIDTH]} />
            <meshStandardMaterial color={BEAM_COLOR} roughness={0.92} />
          </mesh>
        ))}
      </group>

      <InstancedParts positions={pierHeads}>
        <boxGeometry args={[PIER_SIZE[0] + PIER_HEAD_OVERHANG, PIER_HEAD_HEIGHT, halfWidth * 1.1]} />
        <meshStandardMaterial color={PIER_COLOR} roughness={0.93} />
      </InstancedParts>

      <InstancedParts positions={piers} sizes={sizes}>
        <boxGeometry args={[PIER_SIZE[0], 1, PIER_SIZE[1]]} />
        <meshStandardMaterial color={PIER_COLOR} roughness={0.93} />
      </InstancedParts>
    </group>
  )
}

interface ViaductProps {
  /** Half the deck width, i.e. how far the structure reaches either side. */
  halfWidth: number
  /** The stretch of line carried, in world X. */
  from: number
  to: number
  /** Y the piers stand on. */
  groundY: number
  /** How the line rises and falls along that stretch. */
  alignment: VerticalAlignment
  /** Stretches that are in tunnel, and so carry no deck at all. */
  covered?: readonly Stretch[]
}

export function Viaduct({
  halfWidth,
  from,
  to,
  groundY,
  alignment,
  covered = [],
}: ViaductProps) {
  const spans = useMemo(
    () =>
      uncovered(from, to, covered).flatMap((stretch) =>
        alignmentSections(alignment, stretch.from, stretch.to, {
          level: SPAN_LEVEL,
          graded: SPAN_GRADED,
        }),
      ),
    [alignment, covered, from, to],
  )

  return (
    <group name="viaduct">
      {spans.map((span) => (
        <NearCamera
          key={span.from}
          x={(span.from + span.to) / 2}
          reach={(span.to - span.from) / 2}
        >
          <ViaductSpan
            halfWidth={halfWidth}
            alignment={alignment}
            from={span.from}
            to={span.to}
            fromY={span.fromY}
            toY={span.toY}
            groundY={groundY}
          />
        </NearCamera>
      ))}
    </group>
  )
}

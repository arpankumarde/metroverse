import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { GROUND_Y } from './Daylight'

/**
 * Traffic on the road under the line (PLAN.md §19).
 *
 * It matters out of all proportion to what it costs. A city that is not
 * moving is a model of a city; one bus pulling away from a light is what
 * makes the same geometry read as a place. It is also the only thing in the
 * scene that moves at a different speed from the train, which is what gives
 * the ride a sense of its own speed.
 *
 * There is no simulation here — no lanes changed, no lights obeyed, nothing
 * that could go wrong or cost anything. A fixed pool of vehicles slides along
 * its lane and wraps round a window that travels with the player, so the
 * traffic is always where the player is and there is never any more of it
 * than they can see (PLAN.md §28).
 */

/** How much road is populated, centred on the player. Its edges are in haze. */
const WINDOW = 680

/** How many vehicles are in the pool, across all four lanes. */
const COUNT = 88

/** India drives on the left, so which way a carriageway runs follows from its side. */
const LANES = [16.9, 20.6, 24.3] as const

interface Vehicle {
  z: number
  /** Direction of travel along world X. */
  heading: 1 | -1
  speed: number
  /** Body size, in metres. */
  size: [number, number, number]
  color: string
  /** Where it starts in the window, in metres. */
  offset: number
}

interface VehicleKind {
  /** Relative share of the traffic. */
  weight: number
  /** Length along the road, height, and width. */
  size: [number, number, number]
  /** Speed range, in m/s. */
  speed: [number, number]
}

/** Delhi's road mix: mostly cars, a fair few autos, buses, the odd truck. */
const FLEET: readonly VehicleKind[] = [
  { weight: 52, size: [4.3, 1.5, 1.8], speed: [11, 19] },
  { weight: 18, size: [3.9, 1.4, 1.7], speed: [10, 17] },
  { weight: 12, size: [2.7, 1.7, 1.4], speed: [7, 12] },
  { weight: 10, size: [11.2, 3.1, 2.6], speed: [8, 14] },
  { weight: 8, size: [7.4, 3, 2.4], speed: [7, 13] },
]

const CAR_COLORS = [
  '#d9dcdf',
  '#b9bec3',
  '#8d9298',
  '#3b4047',
  '#6d2f2f',
  '#2f4a6d',
  '#8f8578',
  '#1f1f22',
]

/** DTC buses are red or green; the autos are green and yellow. */
const BIG_COLORS = ['#b23b2e', '#2f7a4a', '#c0c4c7']
const AUTO_COLOR = '#2f6b33'

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fleet(): Vehicle[] {
  const random = seeded(0x5eed)
  const total = FLEET.reduce((sum, kind) => sum + kind.weight, 0)
  const vehicles: Vehicle[] = []

  for (let i = 0; i < COUNT; i++) {
    let roll = random() * total
    let kind: VehicleKind | undefined = FLEET[0]
    for (const candidate of FLEET) {
      roll -= candidate.weight
      if (roll <= 0) {
        kind = candidate
        break
      }
    }
    if (!kind) continue

    // Keeping to the left: traffic heading along +X uses the -Z carriageway.
    const side = random() < 0.5 ? 1 : -1
    const lane = LANES[Math.floor(random() * LANES.length)] ?? LANES[0]

    const big = kind.size[0] > 6
    const auto = kind.size[0] < 3
    const color = auto
      ? AUTO_COLOR
      : big
        ? (BIG_COLORS[Math.floor(random() * BIG_COLORS.length)] ?? BIG_COLORS[0])
        : (CAR_COLORS[Math.floor(random() * CAR_COLORS.length)] ?? CAR_COLORS[0])

    vehicles.push({
      z: side * lane,
      heading: side === 1 ? -1 : 1,
      speed: kind.speed[0] + random() * (kind.speed[1] - kind.speed[0]),
      size: kind.size,
      color: color ?? '#cccccc',
      offset: random() * WINDOW,
    })
  }

  return vehicles
}

/** Scratch transform and colour, so the frame loop allocates nothing. */
const transform = new Object3D()
const tint = new Color()

/** Road surface the wheels sit on, matching the carriageway in `cityBlock`. */
const ROAD_SURFACE = GROUND_Y + 0.05

export function Traffic() {
  const vehicles = useMemo(() => fleet(), [])
  const bodies = useRef<InstancedMesh>(null)
  const glazing = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = bodies.current
    if (!mesh) return

    vehicles.forEach((vehicle, index) => {
      mesh.setColorAt(index, tint.set(vehicle.color))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [vehicles])

  useFrame((state) => {
    const body = bodies.current
    const glass = glazing.current
    if (!body || !glass) return

    const time = state.clock.elapsedTime
    const origin = state.camera.position.x - WINDOW / 2

    vehicles.forEach((vehicle, index) => {
      // Wrapped into a window that follows the player: a vehicle that runs
      // off one end comes back on at the other, well inside the haze.
      const run = vehicle.offset + vehicle.heading * vehicle.speed * time - origin
      const x = origin + ((run % WINDOW) + WINDOW) % WINDOW

      const [length, width, height] = vehicle.size

      transform.position.set(x, ROAD_SURFACE + height / 2, vehicle.z)
      transform.scale.set(length, height, width)
      transform.updateMatrix()
      body.setMatrixAt(index, transform.matrix)

      // The glasshouse: a darker band round the top, which is what stops a
      // vehicle at forty metres reading as a coloured brick.
      transform.position.y = ROAD_SURFACE + height * 0.78
      transform.scale.set(length * 0.72, height * 0.34, width + 0.04)
      transform.updateMatrix()
      glass.setMatrixAt(index, transform.matrix)
    })

    body.instanceMatrix.needsUpdate = true
    glass.instanceMatrix.needsUpdate = true
    body.computeBoundingSphere()
    glass.computeBoundingSphere()
  })

  return (
    <group name="traffic">
      <instancedMesh ref={bodies} args={[undefined, undefined, COUNT]} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" roughness={0.45} metalness={0.15} />
      </instancedMesh>

      <instancedMesh ref={glazing} args={[undefined, undefined, COUNT]} castShadow={false}>
        <boxGeometry />
        <meshStandardMaterial color="#2b3238" roughness={0.3} metalness={0.2} />
      </instancedMesh>
    </group>
  )
}

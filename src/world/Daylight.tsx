import { useMemo, useRef } from 'react'
import { Sky } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Mesh,
  Object3D,
} from 'three'
import { HAZE_COLOR, HAZE_FAR, HAZE_NEAR } from './atmosphere'

/**
 * Delhi daylight over the line (PLAN.md §19, §26).
 *
 * Lighting is three static sources and no more (PLAN.md §28). The sun is the
 * only one that casts; the rest stand in for the bounce that makes a real
 * platform legible in shade — a vault lit by direct sun alone renders as a
 * black tunnel, because almost everything under it faces away from the sun.
 *
 * The sun and the ground travel with the player. A shadow camera tight enough
 * to give a crisp shadow covers a hundred metres or so, and the line is sixty
 * times that: pinning both to the camera means the player always stands in the
 * middle of the lit patch, wherever down the line they have got to.
 */

/** Street level below the viaduct. */
export const GROUND_Y = -9.2

/**
 * Where the sun is, relative to the player. It comes in from the side and
 * fairly low, so it rakes in under the open flank of the vault instead of
 * only hitting the roof.
 */
const SUN: [number, number, number] = [62, 58, 96]

/** The shadow camera only needs to cover the part of the platform in view. */
const SHADOW_SPAN = 92
const SHADOW_DEPTH = 46

/** How much ground is drawn around the player, in metres. */
const GROUND_EXTENT = 1400

/**
 * Being underground (PLAN.md §6, §19).
 *
 * A tunnel is not a dark room — it is a different world, and the thing that
 * sells it is that the air changes. The bright Delhi haze that stands in for
 * distance out on the viaduct becomes a close, dirty murk that swallows the
 * bore forty metres ahead, and the daylight that was raking under the canopy
 * goes almost entirely, leaving the strip lights on the tunnel wall to do
 * the work.
 *
 * It is driven off how far below street level the camera is, rather than off
 * anything knowing where the tunnels are. Ride into one and the world dims
 * because you went down, which is the same reason it does in life.
 */
const MURK_COLOR = '#14171b'
const MURK_NEAR = 3
const MURK_FAR = 78

/** Camera heights, relative to street level, between which the change runs. */
const DAYLIGHT_AT = 1
const FULLY_UNDER = -3

/** Lighting at the two ends of that. */
const SUN_UNDERGROUND = 0.22
const HEMISPHERE_UNDERGROUND = 0.2
const AMBIENT_UNDERGROUND = 0.26

const SUN_INTENSITY = 1.9
const HEMISPHERE_INTENSITY = 1.5
const AMBIENT_INTENSITY = 0.55

/** Scratch colours, so the frame loop allocates nothing. */
const daylightHaze = new Color(HAZE_COLOR)
const tunnelMurk = new Color(MURK_COLOR)

export function Daylight() {
  const sun = useRef<DirectionalLight>(null)
  const sky = useRef<HemisphereLight>(null)
  const fill = useRef<AmbientLight>(null)
  const ground = useRef<Mesh>(null)
  const haze = useRef<Fog>(null)

  /** What the sun points at: kept under the player, never drawn. */
  const aim = useMemo(() => new Object3D(), [])

  useFrame(({ camera }) => {
    const { x, y, z } = camera.position

    if (sun.current) {
      sun.current.position.set(x + SUN[0], SUN[1], z + SUN[2])
      aim.position.set(x, 0, z)
      aim.updateMatrixWorld()
    }

    ground.current?.position.set(x, GROUND_Y, z)

    // How far under the street the player is, eased so that running out of a
    // portal is a change in the light rather than a switch being thrown.
    const above = y - GROUND_Y
    const under = MathUtils.smoothstep(above, FULLY_UNDER, DAYLIGHT_AT)
    const depth = 1 - under

    if (sun.current) {
      sun.current.intensity = MathUtils.lerp(SUN_INTENSITY, SUN_UNDERGROUND, depth)
    }
    if (sky.current) {
      sky.current.intensity = MathUtils.lerp(HEMISPHERE_INTENSITY, HEMISPHERE_UNDERGROUND, depth)
    }
    if (fill.current) {
      fill.current.intensity = MathUtils.lerp(AMBIENT_INTENSITY, AMBIENT_UNDERGROUND, depth)
    }

    const fog = haze.current
    if (fog) {
      fog.color.copy(daylightHaze).lerp(tunnelMurk, depth)
      fog.near = MathUtils.lerp(HAZE_NEAR, MURK_NEAR, depth)
      fog.far = MathUtils.lerp(HAZE_FAR, MURK_FAR, depth)
    }
  })

  return (
    <>
      <Sky sunPosition={SUN} turbidity={7} rayleigh={1.4} mieCoefficient={0.006} />
      <fog ref={haze} attach="fog" args={[HAZE_COLOR, HAZE_NEAR, HAZE_FAR]} />

      {/* Sky above, and the pale concrete deck bouncing back up from below. */}
      <hemisphereLight ref={sky} args={['#dbe8f5', '#b0a894', HEMISPHERE_INTENSITY]} />

      {/* Flat fill for everything the hemisphere leaves facing sideways —
          chiefly the soffit and the inboard faces under the vault. */}
      <ambientLight ref={fill} intensity={AMBIENT_INTENSITY} color="#c9d2dc" />

      <directionalLight
        ref={sun}
        position={SUN}
        target={aim}
        intensity={SUN_INTENSITY}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.04}
        shadow-camera-left={-SHADOW_SPAN}
        shadow-camera-right={SHADOW_SPAN}
        shadow-camera-top={SHADOW_DEPTH}
        shadow-camera-bottom={-SHADOW_DEPTH}
        shadow-camera-near={1}
        shadow-camera-far={320}
      />

      <mesh ref={ground} position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND_EXTENT, GROUND_EXTENT]} />
        <meshStandardMaterial color="#8e8878" roughness={1} />
      </mesh>
    </>
  )
}

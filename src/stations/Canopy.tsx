import { useMemo } from 'react'
import { CatmullRomCurve3, ExtrudeGeometry, TubeGeometry, Vector3 } from 'three'
import { InstancedParts, type Vec3 } from '../components/InstancedParts'
import type { CanopyConfig } from '../data/types'
import { archPoint, archShape, purlinPlacements, ribCentersX, ribCurvePoints } from './canopyGeometry'

/** Galvanised sheet outside, lighter soffit inside. One material does both. */
const SHELL_COLOR = '#c8ced3'
const STEEL_COLOR = '#5a656c'
const PURLIN_COLOR = '#6d777d'

/** Radial segments on the rib tubes. Low: they are 13 cm across. */
const RIB_RADIAL_SEGMENTS = 8
const RIB_PATH_SEGMENTS = 44

const PURLIN_SIZE: [number, number] = [0.09, 0.16]

/** Where the fluorescent battens sit on the arch, as a fraction from the crown. */
const BATTEN_U = 0.42
const BATTEN_SIZE: [number, number] = [0.3, 0.09]

const COLUMN_RADIUS = 0.14
const COLUMN_SEGMENTS = 10

interface CanopyProps {
  canopy: CanopyConfig
  /** Y the columns stand on, i.e. the platform deck. */
  baseY: number
}

/**
 * The barrel-vault shelter over an elevated station (PLAN.md §8).
 *
 * Built as four parts, each one draw call: the extruded roof shell, the
 * tubular arch ribs, the longitudinal purlins tying them together, and the
 * columns carrying the springing line. Continuous light battens run the
 * length of the vault above each platform.
 */
export function Canopy({ canopy, baseY }: CanopyProps) {
  const ribX = useMemo(() => ribCentersX(canopy), [canopy])

  const shell = useMemo(() => {
    const geometry = new ExtrudeGeometry(archShape(canopy), {
      depth: canopy.length,
      bevelEnabled: false,
      steps: 1,
    })
    // The shape is drawn in (z, y); turn the extrusion to run along the track.
    geometry.rotateY(Math.PI / 2)
    geometry.translate(-canopy.length / 2, 0, 0)
    return geometry
  }, [canopy])

  const rib = useMemo(() => {
    const points = ribCurvePoints(canopy).map(({ y, z }) => new Vector3(0, y, z))
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0)
    return new TubeGeometry(curve, RIB_PATH_SEGMENTS, canopy.ribRadius, RIB_RADIAL_SEGMENTS, false)
  }, [canopy])

  const ribPositions = useMemo<Vec3[]>(() => ribX.map((x) => [x, 0, 0]), [ribX])

  const purlins = useMemo(() => purlinPlacements(canopy), [canopy])
  const purlinPositions = useMemo(() => purlins.map((p) => p.position), [purlins])
  const purlinRotations = useMemo(() => purlins.map((p) => p.rotation), [purlins])

  const columns = useMemo<Vec3[]>(() => {
    const height = canopy.springY - baseY
    return ribX.flatMap((x) =>
      [canopy.halfSpan, -canopy.halfSpan].map(
        (z) => [x, baseY + height / 2, z] as Vec3,
      ),
    )
  }, [baseY, canopy, ribX])

  const battens = useMemo(
    () => [BATTEN_U, -BATTEN_U].map((u) => archPoint(canopy, u, canopy.ribRadius * 3)),
    [canopy],
  )

  return (
    <group name="canopy">
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial color={SHELL_COLOR} roughness={0.72} metalness={0.25} />
      </mesh>

      <InstancedParts positions={ribPositions}>
        <primitive object={rib} attach="geometry" />
        <meshStandardMaterial color={STEEL_COLOR} roughness={0.55} metalness={0.5} />
      </InstancedParts>

      <InstancedParts positions={purlinPositions} rotations={purlinRotations}>
        <boxGeometry args={[canopy.length, PURLIN_SIZE[1], PURLIN_SIZE[0]]} />
        <meshStandardMaterial color={PURLIN_COLOR} roughness={0.6} metalness={0.4} />
      </InstancedParts>

      <InstancedParts positions={columns} rotation={[0, 0, 0]}>
        <cylinderGeometry
          args={[COLUMN_RADIUS, COLUMN_RADIUS * 1.25, canopy.springY - baseY, COLUMN_SEGMENTS]}
        />
        <meshStandardMaterial color={STEEL_COLOR} roughness={0.5} metalness={0.55} />
      </InstancedParts>

      {battens.map(({ y, z, tilt }) => (
        <mesh key={z} position={[0, y, z]} rotation={[tilt, 0, 0]}>
          <boxGeometry args={[canopy.length * 0.96, BATTEN_SIZE[1], BATTEN_SIZE[0]]} />
          <meshStandardMaterial
            color="#f4f8ff"
            emissive="#eaf2ff"
            emissiveIntensity={1.4}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

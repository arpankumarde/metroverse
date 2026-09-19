import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'

export type Vec3 = readonly [number, number, number]

/** A box part of arbitrary size: one instance of the unit cube, scaled. */
export interface Panel {
  position: Vec3
  size: Vec3
  /** Optional per-panel colour; see `colors` on `InstancedParts`. */
  color?: string
}

interface InstancedPartsProps {
  /** One copy of the geometry per entry. */
  positions: readonly Vec3[]
  /** Per-copy scale, parallel to `positions`. The geometry must be a unit cube. */
  sizes?: readonly Vec3[]
  /** Euler rotation applied to every copy. */
  rotation?: Vec3
  /** Per-copy Euler rotations, parallel to `positions`. Overrides `rotation`. */
  rotations?: readonly Vec3[]
  /**
   * Per-copy colour, parallel to `positions`.
   *
   * This is what lets a whole city block — every wall, every parapet, every
   * kerb — be one draw call instead of one per shade of concrete. The parts
   * still share a material, so they share its roughness and metalness; only
   * the colour varies (PLAN.md §28).
   */
  colors?: readonly string[]
  /** Off for glazing and for anything that only ever exists inside the car. */
  castShadow?: boolean
  receiveShadow?: boolean
  /** Geometry and material elements, exactly as for a `<mesh>`. */
  children: ReactNode
}

const IDENTITY: Vec3 = [0, 0, 0]
const UNIT: Vec3 = [1, 1, 1]

/** Scratch colour, reused so painting a block allocates nothing per instance. */
const tint = new Color()

/**
 * Many identical boxes/cylinders in a single draw call.
 *
 * Sleepers, rails, wheels, door leaves, window panes, wall panels and grab
 * handles are all the same part repeated dozens to hundreds of times;
 * instancing them is what keeps the draw-call count inside the performance
 * budget (PLAN.md §28).
 *
 * `sizes` widens that to parts that are the same *shape* but not the same
 * size — chiefly the wall panels left between the windows and doorways, which
 * are all different lengths and would otherwise be a mesh each.
 */
export function InstancedParts({
  positions,
  sizes,
  rotation,
  rotations,
  colors,
  castShadow = true,
  receiveShadow = true,
  children,
}: InstancedPartsProps) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || positions.length === 0) return

    const dummy = new Object3D()

    positions.forEach((position, index) => {
      const euler = rotations?.[index] ?? rotation ?? IDENTITY
      const size = sizes?.[index] ?? UNIT
      dummy.rotation.set(euler[0], euler[1], euler[2])
      dummy.scale.set(size[0], size[1], size[2])
      dummy.position.set(position[0], position[1], position[2])
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })

    if (colors) {
      colors.forEach((color, index) => {
        mesh.setColorAt(index, tint.set(color))
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [positions, sizes, rotation, rotations, colors])

  // An empty instanced mesh has no bounding sphere to compute, which trips up
  // frustum culling; a stock with no windows or no doors is a legal config.
  if (positions.length === 0) return null

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, positions.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
    </instancedMesh>
  )
}

interface InstancedPanelsProps
  extends Omit<InstancedPartsProps, 'positions' | 'sizes' | 'colors'> {
  panels: readonly Panel[]
}

/**
 * `InstancedParts` for a set of differently sized boxes. The child geometry
 * must be a plain unit `<boxGeometry />`; the size comes from the panel.
 */
export function InstancedPanels({ panels, children, ...rest }: InstancedPanelsProps) {
  const positions = useMemo(() => panels.map((panel) => panel.position), [panels])
  const sizes = useMemo(() => panels.map((panel) => panel.size), [panels])

  // All-or-nothing: a partly coloured set would leave the rest of the
  // instances black rather than the material's own colour.
  const colors = useMemo(() => {
    if (!panels.some((panel) => panel.color)) return undefined
    return panels.map((panel) => panel.color ?? '#ffffff')
  }, [panels])

  return (
    <InstancedParts positions={positions} sizes={sizes} colors={colors} {...rest}>
      {children}
    </InstancedParts>
  )
}

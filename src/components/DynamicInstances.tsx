import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, Object3D } from 'three'

interface DynamicInstancesProps {
  count: number
  /** The one value the placement depends on, read fresh every frame. */
  driver: RefObject<number>
  /** Place instance `index` for the current value of the driver. */
  place: (transform: Object3D, index: number, value: number) => void
  /** Off for glazing, which should let the sun through rather than block it. */
  castShadow?: boolean
  receiveShadow?: boolean
  /** Geometry and material elements, exactly as for a `<mesh>`. */
  children: ReactNode
}

/** Scratch transform, reused so the frame loop allocates nothing. */
const transform = new Object3D()

/**
 * Many identical parts in one draw call, re-placed whenever the single value
 * they move with changes: door leaves against how far the doors are open,
 * wheels against how far the train has run.
 *
 * `InstancedParts` is the static counterpart, and the split is what keeps a
 * moving train cheap. A train is almost entirely fixed geometry with two
 * moving parts, so only those parts pay for matrix writes, and even they pay
 * nothing while the value they follow is holding still (PLAN.md §28).
 *
 * The driver is a ref rather than a prop because these move every frame: going
 * through React state would re-render the whole train sixty times a second.
 */
export function DynamicInstances({
  count,
  driver,
  place,
  castShadow = true,
  receiveShadow = true,
  children,
}: DynamicInstancesProps) {
  const mesh = useRef<InstancedMesh>(null)

  /** Last value written into the matrices; NaN forces the first write. */
  const written = useRef(Number.NaN)

  useLayoutEffect(() => {
    written.current = Number.NaN
  }, [count, place])

  useFrame(() => {
    const instances = mesh.current
    if (!instances || driver.current === written.current) return
    written.current = driver.current

    for (let index = 0; index < count; index++) {
      transform.position.set(0, 0, 0)
      transform.rotation.set(0, 0, 0)
      place(transform, index, driver.current)
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
    }

    instances.instanceMatrix.needsUpdate = true
    instances.computeBoundingSphere()
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
    </instancedMesh>
  )
}

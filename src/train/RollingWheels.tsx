import type { ReactNode, RefObject } from 'react'
import { Object3D } from 'three'
import { DynamicInstances } from '../components/DynamicInstances'
import type { Vec3 } from '../components/InstancedParts'

interface RollingWheelsProps {
  positions: readonly Vec3[]
  radius: number
  /** How far the train has run, in metres. The wheels turn to match. */
  travelled: RefObject<number>
  /** Geometry and material elements, exactly as for a `<mesh>`. */
  children: ReactNode
}

/**
 * The train's wheels, turning at the rate the ground is passing under them.
 *
 * Worth the matrix writes: from the far platform you look straight into the
 * track well under a train, and a wheel that stays still while the train
 * crawls on to its mark is the one thing that gives the whole approach away.
 */
export function RollingWheels({ positions, radius, travelled, children }: RollingWheelsProps) {
  const place = (transform: Object3D, index: number, distance: number) => {
    const [x, y, z] = positions[index]
    transform.position.set(x, y, z)
    // The cylinder is built about +Y, so turning it about Y rolls it and the
    // quarter turn about X then lays its axle across the track.
    transform.rotation.set(Math.PI / 2, distance / radius, 0)
  }

  return (
    <DynamicInstances count={positions.length} driver={travelled} place={place}>
      {children}
    </DynamicInstances>
  )
}

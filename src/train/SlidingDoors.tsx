import type { ReactNode, RefObject } from 'react'
import { Object3D } from 'three'
import { DynamicInstances } from '../components/DynamicInstances'
import type { DoorLeaf } from './geometry'

interface SlidingDoorsProps {
  leaves: readonly DoorLeaf[]
  /** How far a leaf runs from shut to fully open, in metres. */
  travel: number
  /** Side of the car that opens; leaves on the other side stay shut. */
  openSide: 1 | -1
  /** 0 shut … 1 fully open, read fresh every frame. */
  open: RefObject<number>
  /** Off for the door glazing, which lets the sun through rather than blocking it. */
  castShadow?: boolean
  /** Geometry and material elements, exactly as for a `<mesh>`. */
  children: ReactNode
}

/**
 * Every door leaf on the train in one mesh, slid apart by however far the
 * train's runtime says its doors are open.
 *
 * Only the platform side opens, as on the real stock. The offside leaves are
 * in the same mesh and simply never move.
 */
export function SlidingDoors({
  leaves,
  travel,
  openSide,
  open,
  castShadow = true,
  children,
}: SlidingDoorsProps) {
  const place = (transform: Object3D, index: number, open: number) => {
    const leaf = leaves[index]
    const [x, y, z] = leaf.position
    transform.position.set(leaf.side === openSide ? x + leaf.slide * travel * open : x, y, z)
  }

  return (
    <DynamicInstances count={leaves.length} driver={open} place={place} castShadow={castShadow}>
      {children}
    </DynamicInstances>
  )
}

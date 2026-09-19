import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { VIEW_DISTANCE } from '../world/atmosphere'

interface NearCameraProps {
  /** Centre of what is inside, in world X and Z. */
  x: number
  z?: number
  /**
   * How far the contents reach from that centre, in metres. Added to the view
   * distance so a chunk is kept while any part of it could still be seen.
   */
  reach?: number
  children: ReactNode
}

/**
 * Contents that are only drawn while the camera is near enough to see them.
 *
 * A line six kilometres long is mostly somewhere else: at any moment all but
 * a few hundred metres of it is behind the haze, and drawing the rest of it
 * is work thrown away. Splitting the line into chunks and switching each one
 * off past the fog keeps the whole corridor at the cost of the part of it the
 * player can actually see (PLAN.md §28).
 *
 * Only ever use this for scenery that the haze genuinely hides. Anything
 * that would blink out in front of the player belongs in the scene proper.
 */
export function NearCamera({ x, z = 0, reach = 0, children }: NearCameraProps) {
  const group = useRef<Group>(null)
  const limit = VIEW_DISTANCE + reach

  useFrame((state) => {
    const scene = group.current
    if (!scene) return

    const dx = state.camera.position.x - x
    const dz = state.camera.position.z - z
    scene.visible = dx * dx + dz * dz <= limit * limit
  })

  // Hidden until the first frame has placed the camera, so a chunk on the far
  // side of the line cannot flash up before it is tested.
  return (
    <group ref={group} visible={false}>
      {children}
    </group>
  )
}

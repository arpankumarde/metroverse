import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'

/** Stop just short of straight up/down so the view never flips (PLAN.md §3). */
const PITCH_LIMIT = MathUtils.degToRad(85)

/** Radians of rotation per pixel dragged. */
const DEFAULT_SENSITIVITY = 0.0026

/** Exponential smoothing rate; higher follows the cursor more tightly. */
const SMOOTHING = 18

export interface LookAngles {
  yaw: number
  pitch: number
}

export interface DragLookOptions extends Partial<LookAngles> {
  sensitivity?: number
}

/**
 * First-person mouse look that only rotates while a mouse button is held.
 *
 * Deliberately not pointer lock: moving the mouse across the page does
 * nothing, and the view turns only for the distance the cursor travels
 * between pointerdown and pointerup. Rotation is smoothed and the pitch
 * clamped, matching PLAN.md §3.
 *
 * Returns the smoothed angles rather than driving the camera itself, because
 * walking has to move along the same heading the player is looking down.
 */
export function useDragLook({
  yaw = 0,
  pitch = 0,
  sensitivity = DEFAULT_SENSITIVITY,
}: DragLookOptions = {}): RefObject<LookAngles> {
  // Where the drag has asked the view to point, and where it currently is.
  const target = useRef<LookAngles>({ yaw, pitch })
  const current = useRef<LookAngles>({ yaw, pitch })

  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const el = gl.domElement
    let activePointer: number | null = null
    let lastX = 0
    let lastY = 0

    // Deltas are tracked by hand rather than read from `movementX`, which is
    // only dependable under pointer lock.
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || activePointer !== null) return
      activePointer = event.pointerId
      lastX = event.clientX
      lastY = event.clientY
      el.setPointerCapture(event.pointerId)
      el.classList.add('dragging')
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY

      target.current.yaw -= dx * sensitivity
      target.current.pitch = MathUtils.clamp(
        target.current.pitch - dy * sensitivity,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      )
    }

    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
      activePointer = null
      el.classList.remove('dragging')
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.classList.remove('dragging')
    }
  }, [gl, sensitivity])

  // Registered before the player's own frame callback, so whatever reads
  // these angles this frame sees them already eased.
  useFrame((_, delta) => {
    const t = 1 - Math.exp(-SMOOTHING * delta)
    current.current.yaw = MathUtils.lerp(current.current.yaw, target.current.yaw, t)
    current.current.pitch = MathUtils.lerp(current.current.pitch, target.current.pitch, t)
  })

  return current
}

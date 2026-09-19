import { useEffect, useRef, type RefObject } from 'react'

/**
 * Walking intent, read once per frame rather than pushed through React state
 * so holding a key never re-renders the scene (PLAN.md §12).
 */
export interface MoveInput {
  /** -1 backward .. +1 forward. */
  forward: number
  /** -1 left .. +1 right. */
  strafe: number
  sprint: boolean
}

const FORWARD = ['KeyW', 'ArrowUp']
const BACKWARD = ['KeyS', 'ArrowDown']
const LEFT = ['KeyA', 'ArrowLeft']
const RIGHT = ['KeyD', 'ArrowRight']
const SPRINT = ['ShiftLeft', 'ShiftRight']

/** Every code we care about, so unrelated keystrokes fall through untouched. */
const TRACKED = new Set([...FORWARD, ...BACKWARD, ...LEFT, ...RIGHT, ...SPRINT])

/**
 * WASD or the arrow keys, with shift to run.
 *
 * Keys are matched on `event.code`, which is the physical key, so the same
 * finger positions work on a non-QWERTY layout.
 */
export function useMoveInput(): RefObject<MoveInput> {
  const input = useRef<MoveInput>({ forward: 0, strafe: 0, sprint: false })

  useEffect(() => {
    const held = new Set<string>()
    const anyHeld = (codes: string[]) => codes.some((code) => held.has(code))

    const sync = () => {
      input.current.forward = (anyHeld(FORWARD) ? 1 : 0) - (anyHeld(BACKWARD) ? 1 : 0)
      input.current.strafe = (anyHeld(RIGHT) ? 1 : 0) - (anyHeld(LEFT) ? 1 : 0)
      input.current.sprint = anyHeld(SPRINT)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!TRACKED.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return
      // The arrows would otherwise scroll the page out from under the canvas.
      if (event.code.startsWith('Arrow')) event.preventDefault()
      if (event.repeat) return
      held.add(event.code)
      sync()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (!held.delete(event.code)) return
      sync()
    }

    // Keys held while the tab or window loses focus never send their keyup,
    // which would otherwise leave the player walking forever.
    const release = () => {
      if (held.size === 0) return
      held.clear()
      sync()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', release)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
    }
  }, [])

  return input
}

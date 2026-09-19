import { useFrame } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { stepRoad } from './lineService'
import { RoadsContext, type Road } from './roads'

/**
 * The trains of the line, stepped once per frame in one place (PLAN.md §16).
 *
 * Only this component steps the simulation. Consumers read the runtimes in
 * their own `useFrame`, which by React's effect ordering means they see the
 * step taken on the previous frame; a shared sixteen milliseconds of lag is
 * invisible, and it keeps every reader agreeing with every other.
 *
 * The service itself is made in `lineService.ts` and handed in, because the
 * player's walkable floor includes the floor of every train and so has to be
 * assembled before any of this is rendered.
 */

/** A step this long means the tab was in the background; don't lurch. */
const MAX_STEP = 0.1

interface ServiceClockProps {
  roads: ReadonlyMap<string, Road>
  children: ReactNode
}

export function ServiceClock({ roads, children }: ServiceClockProps) {
  useFrame((_, delta) => {
    const step = Math.min(delta, MAX_STEP)
    if (step <= 0) return
    for (const road of roads.values()) stepRoad(road, step)
  })

  return <RoadsContext value={roads}>{children}</RoadsContext>
}

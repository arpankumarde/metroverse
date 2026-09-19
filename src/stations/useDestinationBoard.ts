import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { CanvasTexture } from 'three'
import type { BilingualName } from '../data/types'
import { callAt } from '../train/line'
import { ArrivalPhase, arrivalPhase, secondsToArrival } from '../train/predict'
import { useRoad } from '../train/roads'
import { DESTINATION_BOARD_PIXELS, drawDestinationBoard, liveSignTexture } from './signTexture'

/**
 * The live wait time on the suspended destination board (PLAN.md §16).
 *
 * The board is not on a timer: every tick of it is read off the train state
 * machine for its own road, which is the same run the announcements and the
 * trains themselves use. The train it counts down to may be four stations
 * away and still standing at one of them — the figure on the board includes
 * everything it has left to do on the way here, so when it is held up, the
 * board is held up with it.
 *
 * It is repainted only when the face would actually read differently — about
 * once a second — rather than every frame.
 */

/** What the right-hand column reads once counting is no longer the point. */
const ARRIVING: BilingualName = { hi: 'आ रही है', en: 'Arriving' }
const AT_PLATFORM: BilingualName = { hi: 'आ गई है', en: 'Arrived' }

/** Before the first frame has run the simulation there is nothing to show. */
const BLANK: BilingualName = { hi: '--:--', en: '--:--' }

function countdown(seconds: number): BilingualName {
  if (!Number.isFinite(seconds)) return BLANK

  const whole = Math.max(0, Math.ceil(seconds))
  const clock = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
  return { hi: clock, en: clock }
}

export function useDestinationBoard(
  towards: BilingualName,
  trackId: string,
  stationId: string,
): CanvasTexture {
  const road = useRoad(trackId)

  /** Which of the road's calls this station is. */
  const call = useMemo(
    () => (road ? callAt(road.schedule, stationId) : -1),
    [road, stationId],
  )

  const sign = useMemo(
    () =>
      liveSignTexture(
        DESTINATION_BOARD_PIXELS.width,
        DESTINATION_BOARD_PIXELS.height,
        (ctx, w, h) => drawDestinationBoard(ctx, w, h, towards, BLANK),
      ),
    [towards],
  )

  useEffect(() => () => sign.texture.dispose(), [sign])

  /** What is painted on the face now, so an unchanged face is left alone. */
  const painted = useRef('')

  useFrame(() => {
    let wait = BLANK
    if (road && call >= 0) {
      const phase = arrivalPhase(road, call)
      wait =
        phase === ArrivalPhase.AT_PLATFORM
          ? AT_PLATFORM
          : phase === ArrivalPhase.ARRIVING
            ? ARRIVING
            : countdown(secondsToArrival(road, call))
    }

    const face = `${towards.en}|${wait.en}`
    if (face === painted.current) return
    painted.current = face

    sign.redraw((ctx, w, h) => drawDestinationBoard(ctx, w, h, towards, wait))
  })

  return sign.texture
}

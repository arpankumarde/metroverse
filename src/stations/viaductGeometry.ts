import {
  alignmentSections,
  railY,
  type AlignmentSection,
  type Stretch,
} from '../data/alignment'
import type { VerticalAlignment } from '../data/types'
import { TRACK_BASE_Y } from './geometry'

/**
 * The elevated structure the line stands on, as arithmetic.
 *
 * Split out of `Viaduct` because more than the renderer needs it: the
 * concourse hangs its ceiling from the underside of this deck, and the piers
 * stand in the middle of that hall, where a player would otherwise walk
 * straight through them.
 */

export const DECK_THICKNESS = 1

/** Rail top is the top of the deck; the deck is what the trackbed sits on. */
export const DECK_TOP_Y = TRACK_BASE_Y
export const DECK_BOTTOM_Y = DECK_TOP_Y - DECK_THICKNESS

/** One pier bay. Spans are cut to a whole number of these (PLAN.md §7). */
export const PIER_SPACING = 27

/** Plan size of a pier: along the line, then across it. */
export const PIER_SIZE: [number, number] = [2.4, 1.6]

/** Length of one drawn span of deck, level and on a ramp, in metres. */
const SPAN_LEVEL = PIER_SPACING * 4
const SPAN_GRADED = PIER_SPACING * 2

/** The parts of a stretch that are not inside any of `covered`, in order. */
function uncovered(from: number, to: number, covered: readonly Stretch[]): Stretch[] {
  const open: Stretch[] = []
  let at = from

  for (const stretch of [...covered].sort((a, b) => a.from - b.from)) {
    if (stretch.from > at) open.push({ from: at, to: Math.min(stretch.from, to) })
    at = Math.max(at, stretch.to)
    if (at >= to) break
  }

  if (at < to) open.push({ from: at, to })

  return open.filter((stretch) => stretch.to - stretch.from > 1)
}

/**
 * The spans of deck a stretch of line is drawn as: on the viaduct, following
 * the alignment down its ramps, and not at all where it is in tunnel.
 */
export function viaductSpans(
  alignment: VerticalAlignment,
  from: number,
  to: number,
  covered: readonly Stretch[] = [],
): AlignmentSection[] {
  return uncovered(from, to, covered).flatMap((stretch) =>
    alignmentSections(alignment, stretch.from, stretch.to, {
      level: SPAN_LEVEL,
      graded: SPAN_GRADED,
    }),
  )
}

/**
 * How many bays a span is cut into, and where the pier at the near end of each
 * stands. The near end of a span carries a pier and the far end does not,
 * which is what stops two spans doubling one up at every joint.
 */
export function spanPierChainages(from: number, to: number): number[] {
  const runX = to - from
  const bays = Math.max(1, Math.round(runX / PIER_SPACING))
  return Array.from({ length: bays }, (_, i) => from + (i * runX) / bays)
}

/** Where every pier of a stretch of line stands, whether or not it is drawn. */
export function viaductPiers(
  alignment: VerticalAlignment,
  from: number,
  to: number,
  covered: readonly Stretch[] = [],
): number[] {
  return viaductSpans(alignment, from, to, covered).flatMap((span) =>
    spanPierChainages(span.from, span.to),
  )
}

/** Height of the underside of the deck at a chainage. */
export function deckUnderside(alignment: VerticalAlignment, x: number): number {
  return railY(alignment, x) + DECK_BOTTOM_Y
}

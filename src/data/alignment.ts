import type { CorridorConfig, GradePoint, VerticalAlignment } from './types'

/**
 * How the line rises and falls along its length (PLAN.md §6, §19).
 *
 * The Blue Line is not a flat shelf. It runs on viaduct through the stations
 * that are built here, and between two of them it drops off the end of the
 * viaduct, runs down a ramp and into a box tunnel under the road, and climbs
 * back out again. From inside a coach that is the single biggest thing that
 * happens on the ride: daylight goes, the window turns into a mirror, the
 * tunnel wall rips past a metre away, and then the city comes back.
 *
 * The alignment is a list of heights at chainages and nothing else. Where a
 * tunnel is, how deep it is and how long its ramps are is a data edit to the
 * table at the bottom of this file; no component decides any of it.
 */

/** A level line, for a corridor that declares no alignment of its own. */
export const LEVEL: VerticalAlignment = [{ x: 0, y: 0 }]

/**
 * Smoothstep, which is the vertical curve.
 *
 * A railway ramp is not a straight grade between two levels — it is a
 * straight grade with a parabolic curve easing into it at each knuckle,
 * because a train taking a change of gradient as a corner would ride it as a
 * jolt. Easing the whole ramp gives the same thing in one expression: zero
 * gradient where it leaves the level, zero gradient where it meets the next,
 * and the steepest part in the middle.
 *
 * The cost is that the steepest part is 1.5x the average, so a ramp has to be
 * half again as long as a straight grade at the same ruling gradient.
 */
function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

/** d/dt of `ease`, used to turn a height difference into a gradient. */
function easeSlope(t: number): number {
  return 6 * t * (1 - t)
}

/** The steepest gradient a ramp of this length and rise reaches, as a ratio. */
export function rulingGradient(rise: number, length: number): number {
  return length === 0 ? 0 : Math.abs((1.5 * rise) / length)
}

/** The pair of grade points either side of a chainage. */
function span(alignment: VerticalAlignment, x: number): [GradePoint, GradePoint] {
  const first = alignment[0]
  const last = alignment.at(-1)
  if (!first || !last) throw new Error('A vertical alignment needs at least one grade point')

  if (x <= first.x) return [first, first]
  if (x >= last.x) return [last, last]

  for (let i = 1; i < alignment.length; i++) {
    const ahead = alignment[i]
    const behind = alignment[i - 1]
    if (ahead && behind && x <= ahead.x) return [behind, ahead]
  }

  return [last, last]
}

/** Rail top at a chainage, relative to rail top on the viaduct. */
export function railY(alignment: VerticalAlignment, x: number): number {
  const [from, to] = span(alignment, x)
  if (from === to || to.x === from.x) return to.y
  return from.y + (to.y - from.y) * ease((x - from.x) / (to.x - from.x))
}

/**
 * The gradient at a chainage, as a ratio: negative running downhill along +X.
 *
 * This is what a train is pitched by, so it has to come from the same curve
 * the track is drawn on rather than from a difference taken across it — a
 * train nosing down while the rails under it stay level is exactly the sort
 * of drift the single source of truth is there to prevent (PLAN.md §16).
 */
export function railGradient(alignment: VerticalAlignment, x: number): number {
  const [from, to] = span(alignment, x)
  if (from === to || to.x === from.x) return 0

  const length = to.x - from.x
  return ((to.y - from.y) / length) * easeSlope((x - from.x) / length)
}

/** Pitch of the track at a chainage, in radians, for a train working along +X. */
export function railPitch(alignment: VerticalAlignment, x: number): number {
  return Math.atan(railGradient(alignment, x))
}

/** Whether the line is dead level for the whole of a stretch. */
export function isLevel(alignment: VerticalAlignment, from: number, to: number): boolean {
  return railY(alignment, from) === 0 && railY(alignment, to) === 0 &&
    alignment.every((point) => point.x <= from || point.x >= to || point.y === 0)
}

/**
 * One drawn length of line, with the height of each of its ends.
 *
 * The line is drawn as a chain of straight pieces, each tilted to the grade
 * at its own ends. On the level that can be a long piece; on a ramp it has to
 * be a short one, or the eased curve would be visibly cut into facets and the
 * joints between them would read as kinks in the rail.
 */
export interface AlignmentSection {
  from: number
  to: number
  fromY: number
  toY: number
}

interface SectionOptions {
  /** Target length of a piece where the line is level, in metres. */
  level: number
  /** Target length of a piece on a ramp, in metres. */
  graded: number
  /** Chainages a piece may never straddle — portals, chiefly. */
  breaks?: readonly number[]
}

/**
 * Cut a stretch of line into drawable pieces that follow the alignment.
 *
 * Every grade point is a break, so no piece ever spans a knuckle, and the
 * pieces on a ramp come out short because the ramp is one span of the
 * alignment and gets the graded length. Callers add breaks of their own for
 * anything else a piece must not straddle.
 */
export function alignmentSections(
  alignment: VerticalAlignment,
  from: number,
  to: number,
  { level, graded, breaks = [] }: SectionOptions,
): AlignmentSection[] {
  const inside = [...alignment.map((point) => point.x), ...breaks]
    .filter((x) => x > from && x < to)

  const knuckles = [from, ...inside, to].sort((a, b) => a - b)
  const sections: AlignmentSection[] = []

  for (let i = 1; i < knuckles.length; i++) {
    const start = knuckles[i - 1]
    const end = knuckles[i]
    if (start === undefined || end === undefined || end - start < 1e-6) continue

    const startY = railY(alignment, start)
    const endY = railY(alignment, end)
    const target = startY === endY ? level : graded
    const count = Math.max(1, Math.round((end - start) / target))
    const pitch = (end - start) / count

    for (let piece = 0; piece < count; piece++) {
      const pieceFrom = start + piece * pitch
      const pieceTo = piece === count - 1 ? end : start + (piece + 1) * pitch
      sections.push({
        from: pieceFrom,
        to: pieceTo,
        fromY: railY(alignment, pieceFrom),
        toY: railY(alignment, pieceTo),
      })
    }
  }

  return sections
}

/** A stretch of chainage, used for the runs of line that are in tunnel. */
export interface Stretch {
  from: number
  to: number
}

/** Resolution the alignment is sampled at when hunting for a crossing. */
const SAMPLE = 2

/**
 * Every run of line whose rail top is at or below `y`, between two chainages.
 *
 * Used to find where the line is low enough to be covered over: the answer is
 * not written down anywhere, it falls out of the alignment, so moving a ramp
 * moves the tunnel and its portals with it and they cannot drift apart.
 */
export function stretchesBelow(
  alignment: VerticalAlignment,
  from: number,
  to: number,
  y: number,
): Stretch[] {
  const found: Stretch[] = []
  let open: number | null = null

  const crossing = (a: number, b: number): number => {
    // Bisect rather than solve: the ramp is a cubic, and two dozen halvings
    // put the portal inside a millimetre of where the curve really crosses.
    let low = a
    let high = b
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2
      if (railY(alignment, mid) <= y) high = mid
      else low = mid
    }
    return high
  }

  let wasBelow = railY(alignment, from) <= y
  if (wasBelow) open = from

  for (let x = from + SAMPLE; x <= to; x += SAMPLE) {
    const at = Math.min(x, to)
    const below = railY(alignment, at) <= y

    if (below && !wasBelow) open = crossing(at, at - SAMPLE)
    if (!below && wasBelow && open !== null) {
      found.push({ from: open, to: crossing(at - SAMPLE, at) })
      open = null
    }

    wasBelow = below
  }

  if (open !== null) found.push({ from: open, to })

  return found
}

/**
 * How much of a station has to be on the level either side of its stopping
 * mark, in metres. A train stands with its centre on the mark, so this is
 * half a train plus a little — a coach with one bogie on a ramp would stand
 * nose-down at the platform.
 */
const LEVEL_AT_STATION = 95

/**
 * Check an alignment against the corridor it belongs to.
 *
 * Stations are built at viaduct level and the platforms are flat, so a ramp
 * that ran under one would leave the train berthed at an angle to its own
 * platform. Catching it here, once, at module load, is much better than
 * finding it by walking into a doorway with a step in it.
 */
export function checkAlignment(corridor: CorridorConfig, alignment: VerticalAlignment): void {
  for (let i = 1; i < alignment.length; i++) {
    const behind = alignment[i - 1]
    const ahead = alignment[i]
    if (behind && ahead && ahead.x <= behind.x) {
      throw new Error(`Alignment of ${corridor.id} has grade points out of order at x=${ahead.x}`)
    }
  }

  for (const { station, x } of corridor.stations) {
    if (!isLevel(alignment, x - LEVEL_AT_STATION, x + LEVEL_AT_STATION)) {
      throw new Error(
        `Alignment of ${corridor.id} is not level through ${station.id} at x=${x}: ` +
          'a station cannot stand on a ramp',
      )
    }
  }
}

/** The alignment of a corridor, level if it does not declare one. */
export function corridorAlignment(corridor: CorridorConfig): VerticalAlignment {
  return corridor.alignment ?? LEVEL
}

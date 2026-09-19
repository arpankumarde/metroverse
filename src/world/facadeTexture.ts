import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * The lettering on the front of a named building (PLAN.md §19).
 *
 * Drawn to a canvas for the same reason the station signage is: the wording
 * is different on every building, so shipping images would mean shipping one
 * per landmark, and the build has to stay a plain static bundle with nothing
 * fetched at runtime.
 *
 * These are read at forty metres from a train doing eighty, so they are set
 * large and plain — the name and nothing else. No attempt is made at the real
 * logos; a bank is its house colour and its name, which at this distance is
 * exactly what you actually recognise anyway.
 */

const HINDI_FONT = `'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Nirmala UI', 'Mangal', sans-serif`
const LATIN_FONT = `'Helvetica Neue', Helvetica, Arial, sans-serif`

const WIDTH = 1024
const HEIGHT = 256

const cache = new Map<string, CanvasTexture>()

/** Fit the text to the plate by shrinking it until it goes in. */
function fitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  size: number,
  maxWidth: number,
): number {
  let at = size
  ctx.font = `${at}px ${font}`
  while (at > 14 && ctx.measureText(text).width > maxWidth) {
    at -= 3
    ctx.font = `${at}px ${font}`
  }
  return at
}

export function landmarkSignTexture(
  name: string,
  hi: string | undefined,
  fascia: string,
  ink: string,
): CanvasTexture {
  const key = `${name}|${hi ?? ''}|${fascia}|${ink}`
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for building signage')

  ctx.fillStyle = fascia
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const margin = WIDTH - 96

  if (hi) {
    ctx.font = `${fitted(ctx, hi, HINDI_FONT, 62, margin)}px ${HINDI_FONT}`
    ctx.fillText(hi, WIDTH / 2, HEIGHT * 0.33, margin)
    ctx.font = `${fitted(ctx, name, LATIN_FONT, 74, margin)}px ${LATIN_FONT}`
    ctx.fillText(name, WIDTH / 2, HEIGHT * 0.71, margin)
  } else {
    ctx.font = `${fitted(ctx, name, LATIN_FONT, 104, margin)}px ${LATIN_FONT}`
    ctx.fillText(name, WIDTH / 2, HEIGHT / 2, margin)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8

  cache.set(key, texture)
  return texture
}

import { CanvasTexture, SRGBColorSpace } from 'three'
import type { BilingualName } from '../data/types'

/**
 * DMRC signage, drawn to canvases at runtime (PLAN.md §8).
 *
 * Every sign in the network is bilingual, and the wording changes per station,
 * per platform and per line — so they are generated rather than shipped as
 * images. That also keeps the build a plain static bundle with no font or
 * texture fetches at runtime.
 *
 * Painted signs are cached and never change. The destination board is a
 * display rather than a sign: it gets a canvas of its own that is repainted as
 * the train it is counting down to gets nearer (PLAN.md §16).
 */

/** Devanagari first, since the Latin fallbacks below it cannot draw it at all. */
const HINDI_FONT = `'Noto Sans Devanagari', 'Kohinoor Devanagari', 'Nirmala UI', 'Mangal', sans-serif`
const LATIN_FONT = `'Helvetica Neue', Helvetica, Arial, sans-serif`

/** Anisotropy for signs read at a glancing angle down a 180 m platform. */
const SIGN_ANISOTROPY = 8

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

function signContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for station signage')
  return ctx
}

function textureFor(ctx: CanvasRenderingContext2D): CanvasTexture {
  const texture = new CanvasTexture(ctx.canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = SIGN_ANISOTROPY
  return texture
}

/**
 * Textures are keyed by their content, so the six name boards along a platform
 * share one canvas rather than drawing the same sign six times.
 */
const cache = new Map<string, CanvasTexture>()

function signTexture(key: string, width: number, height: number, draw: Draw): CanvasTexture {
  const cached = cache.get(key)
  if (cached) return cached

  const ctx = signContext(width, height)
  draw(ctx, width, height)

  const texture = textureFor(ctx)
  cache.set(key, texture)
  return texture
}

/** A sign face that can be repainted in place, for displays that change. */
export interface LiveSign {
  texture: CanvasTexture
  /** Repaint the whole face. Cheap, but meant for a change, not every frame. */
  redraw(draw: Draw): void
}

export function liveSignTexture(width: number, height: number, draw: Draw): LiveSign {
  const ctx = signContext(width, height)
  draw(ctx, width, height)

  const texture = textureFor(ctx)

  return {
    texture,
    redraw(next) {
      next(ctx, width, height)
      texture.needsUpdate = true
    },
  }
}

function centeredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
) {
  ctx.font = `${size}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y, maxWidth)
}

/** Darken a hex colour towards black, for sign backgrounds and borders. */
function shade(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 0xff) * factor)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(16)}${channel(8)}${channel(0)}`
}

/**
 * The board a passenger reads through the train window to know where they
 * are. Backed in the line's own colour, so switching lines re-skins every
 * sign in the station (PLAN.md §10).
 */
export function stationNameTexture(name: BilingualName, lineColor: string): CanvasTexture {
  return signTexture(`name:${name.en}:${lineColor}`, 1024, 244, (ctx, w, h) => {
    ctx.fillStyle = shade(lineColor, 0.82)
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 8
    ctx.strokeRect(14, 14, w - 28, h - 28)

    ctx.fillStyle = '#ffffff'
    centeredText(ctx, name.hi, HINDI_FONT, 66, w / 2, h * 0.36, w - 90)
    centeredText(ctx, name.en, LATIN_FONT, 74, w / 2, h * 0.7, w - 90)
  })
}

/** Lays an LED pixel grid over whatever has been drawn so far. */
function ledGrid(ctx: CanvasRenderingContext2D, w: number, h: number, background: string) {
  ctx.fillStyle = background
  ctx.globalAlpha = 0.55
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h)
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
  ctx.globalAlpha = 1
}

/** Canvas size of the suspended destination board. */
export const DESTINATION_BOARD_PIXELS = { width: 1024, height: 320 } as const

/** Digits get the full display face; a word has to be set smaller to fit. */
function waitFontSize(text: string): number {
  return text.length > 5 ? 38 : 62
}

/**
 * The suspended destination board: amber dot-matrix on navy, headed in both
 * scripts, with the wait on the right (see `references/`).
 *
 * `wait` is whatever the right-hand column should read — a counting-down
 * clock, or a word once the train is close enough that a number is no longer
 * the useful thing to show.
 */
export function drawDestinationBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  towards: BilingualName,
  wait: BilingualName,
): void {
  const background = '#05142c'

  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#7fd4ff'
  ctx.font = `30px ${HINDI_FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('गंतव्य स्थान / Destination', 34, 46, 520)
  ctx.textAlign = 'right'
  ctx.fillText('समय / Time', w - 34, 46, 260)

  ctx.strokeStyle = '#1d4a7a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(24, 76)
  ctx.lineTo(w - 24, 76)
  ctx.stroke()

  ctx.fillStyle = '#ffa521'
  ctx.textAlign = 'left'
  ctx.font = `62px ${HINDI_FONT}`
  ctx.fillText(towards.hi, 34, 140, 640)
  ctx.font = `62px ${LATIN_FONT}`
  ctx.fillText(towards.en, 34, 236, 640)

  ctx.textAlign = 'right'
  ctx.font = `${waitFontSize(wait.hi)}px ${HINDI_FONT}`
  ctx.fillText(wait.hi, w - 34, 140, 260)
  ctx.font = `${waitFontSize(wait.en)}px ${LATIN_FONT}`
  ctx.fillText(wait.en, w - 34, 236, 260)

  ledGrid(ctx, w, h, background)
}

/** Yellow wayfinding gantry: green arrow, then the word in both scripts. */
export function exitSignTexture(): CanvasTexture {
  return signTexture('exit', 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2c31b'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#14803c'
    ctx.fillRect(40, 48, 160, 160)

    // A chunky right-pointing arrow inside the green tile.
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(78, 108)
    ctx.lineTo(132, 108)
    ctx.lineTo(132, 82)
    ctx.lineTo(176, 128)
    ctx.lineTo(132, 174)
    ctx.lineTo(132, 148)
    ctx.lineTo(78, 148)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#101010'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `76px ${HINDI_FONT}`
    ctx.fillText('निकास', 240, h * 0.34, 420)
    ctx.font = `84px ${LATIN_FONT}`
    ctx.fillText('Exit', 240, h * 0.72, 420)
  })
}

/** The small square platform-number plate hung beside the destination board. */
export function platformNumberTexture(number: string, lineColor: string): CanvasTexture {
  return signTexture(`platform:${number}:${lineColor}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = shade(lineColor, 0.72)
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 7
    ctx.strokeRect(12, 12, w - 24, h - 24)

    ctx.fillStyle = '#ffffff'
    centeredText(ctx, number, LATIN_FONT, 150, w / 2, h / 2 + 6, w - 60)
  })
}

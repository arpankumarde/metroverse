import { useSyncExternalStore } from 'react'

/**
 * The announcement currently being read, for the on-screen caption.
 *
 * A plain store rather than React state: announcements are raised from inside
 * the render loop, and the caption is HTML outside the canvas, so this is the
 * one seam between them. Nothing re-renders the scene when the PA speaks.
 */

export interface Announcement {
  /** Changes on every announcement, so a repeated message still replays. */
  id: number
  /** Which platform's speakers it came over. */
  platformNumber: string
  text: string
}

/** How long a caption stays up after it is announced, in seconds. */
const CAPTION_SECONDS = 8

let current: Announcement | null = null
let nextId = 1
let expiry: ReturnType<typeof setTimeout> | undefined

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function raiseAnnouncement(platformNumber: string, text: string): void {
  current = { id: nextId++, platformNumber, text }

  if (expiry !== undefined) clearTimeout(expiry)
  expiry = setTimeout(() => {
    current = null
    expiry = undefined
    emit()
  }, CAPTION_SECONDS * 1000)

  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): Announcement | null {
  return current
}

export function useAnnouncement(): Announcement | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

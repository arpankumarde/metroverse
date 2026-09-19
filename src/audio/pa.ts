/**
 * The station public address voice (PLAN.md §17).
 *
 * Announcements are spoken by the browser's own synthesiser rather than
 * shipped as audio files. The wording changes with the station, the platform,
 * the destination and the wait, so a recording would have to be cut for every
 * combination of the four — and the build has to stay a static bundle with
 * nothing to fetch.
 *
 * Modular on purpose: swapping this for recorded clips later means replacing
 * `speak`, and nothing that announces has to know (PLAN.md §17).
 */

/** Indian English first, then the other non-American English voices. */
const PREFERRED_LANGUAGES = ['en-in', 'en-gb', 'en-au', 'en']

/**
 * The Delhi Metro English announcements are a woman's voice, so the PA looks
 * for one. `SpeechSynthesisVoice` carries no gender, so the only thing to go
 * on is the name: either the platform says so outright ("Google UK English
 * Female"), or it ships a named voice whose gender is known. These are the
 * English voices the common platforms install — Windows, macOS/iOS, Chrome
 * and Android — and anything unrecognised is treated as unknown rather than
 * guessed at.
 *
 * `\bmale\b` does not match "female": there is no word boundary inside it.
 */
const FEMALE_VOICE =
  /\b(female|heera|neerja|zira|aria|jenny|michelle|ana|hazel|libby|sonia|maisie|natasha|clara|catherine|veena|samantha|karen|moira|tessa|fiona|serena|kate|ava|allison|susan|victoria|nicky|martha|lekha|kalpana|shruti|isha)\b/i
const MALE_VOICE =
  /\b(male|ravi|prabhat|david|mark|guy|christopher|eric|roger|steffan|george|ryan|thomas|william|liam|rishi|daniel|oliver|alex|fred|aaron|arthur|gordon|tom|hemant|madhur)\b/i

/** A station PA is unhurried. */
const RATE = 0.92
const VOLUME = 0.9

let voice: SpeechSynthesisVoice | null = null

/**
 * Browsers refuse to speak until the page has been interacted with. Until
 * then announcements are caption-only rather than queued up to burst out at
 * the first click.
 */
let unlocked = false

function synthesiser(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

function speaks(candidate: SpeechSynthesisVoice, language: string): boolean {
  return candidate.lang.replace('_', '-').toLowerCase().startsWith(language)
}

/** The best-accented voice this machine has that the caller will accept. */
function bestAccent(
  voices: SpeechSynthesisVoice[],
  accept: (candidate: SpeechSynthesisVoice) => boolean,
): SpeechSynthesisVoice | null {
  for (const language of PREFERRED_LANGUAGES) {
    const match = voices.find((candidate) => speaks(candidate, language) && accept(candidate))
    if (match) return match
  }
  return null
}

/** Voices load asynchronously, so this runs again whenever the list changes. */
function chooseVoice(): void {
  const voices = synthesiser()?.getVoices() ?? []
  if (voices.length === 0) return

  // A woman's voice wherever one can be identified, even in a less Indian
  // accent — the gender is the more audible half of the PA's character. Where
  // none can be, the accent order decides, skipping the voices known to be
  // men rather than falling into one.
  voice =
    bestAccent(voices, (candidate) => FEMALE_VOICE.test(candidate.name)) ??
    bestAccent(voices, (candidate) => !MALE_VOICE.test(candidate.name)) ??
    bestAccent(voices, () => true) ??
    voices[0] ??
    null
}

/**
 * Start listening for the interaction that lets the PA speak. Returns the
 * teardown, so this is a `useEffect` body.
 */
export function openPA(): () => void {
  const synthesis = synthesiser()
  if (!synthesis) return () => {}

  chooseVoice()
  synthesis.addEventListener('voiceschanged', chooseVoice)

  const unlock = () => {
    unlocked = true
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })

  return () => {
    synthesis.removeEventListener('voiceschanged', chooseVoice)
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    synthesis.cancel()
  }
}

/** Read one announcement over the platform speakers. */
export function speak(text: string): void {
  const synthesis = synthesiser()
  if (!synthesis || !unlocked) return

  if (!voice) chooseVoice()

  // A station PA does not talk over itself: the newest announcement is the
  // one worth hearing, so it cuts anything still playing.
  synthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice?.lang ?? 'en-IN'
  utterance.rate = RATE
  utterance.volume = VOLUME
  synthesis.speak(utterance)
}

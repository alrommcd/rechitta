// Isolated TTS module — backed by Gemini TTS via /api/tts.
// To swap provider: change app/api/tts/route.ts only; this file and all callers stay unchanged.

export type TtsLang = 'en' | 'hi'

export interface TtsControls {
  pause(): void
  resume(): void
  stop(): void
  replay(): void
}

export interface TtsCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onPause?: () => void
  onResume?: () => void
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6} /g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}

// Detects Hindi by presence of Devanagari Unicode block (U+0900–U+097F).
// Kept exported — used externally for language detection outside TTS.
export function detectTtsLang(text: string): TtsLang {
  return /[ऀ-ॿ]/.test(text) ? 'hi' : 'en'
}

// Module-level handle for the currently playing audio so that a new speak()
// call or an explicit stop() always cancels the previous one first.
let activeAudio: HTMLAudioElement | null = null
let activeUrl:   string | null           = null

function releaseActive(): void {
  if (activeAudio) {
    activeAudio.onpause  = null
    activeAudio.onplay   = null
    activeAudio.onended  = null
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }
  if (activeUrl) {
    URL.revokeObjectURL(activeUrl)
    activeUrl = null
  }
}

export function speak(text: string, callbacks: TtsCallbacks = {}): TtsControls {
  // Stop whatever is currently playing before starting a new utterance.
  releaseActive()

  const clean   = stripMarkdown(text)
  let stopped   = false
  let audio: HTMLAudioElement | null = null

  ;(async () => {
    try {
      const res = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: clean }),
      })

      if (stopped) return
      if (!res.ok) throw new Error(`/api/tts returned ${res.status}`)

      const blob   = await res.blob()
      if (stopped) return

      const blobUrl  = URL.createObjectURL(blob)
      activeUrl      = blobUrl

      audio          = new Audio(blobUrl)
      activeAudio    = audio

      // onplay fires on initial play AND on resume from pause — covers both onStart + onResume
      audio.onplay   = () => { callbacks.onStart?.(); callbacks.onResume?.() }
      audio.onpause  = () => { if (!stopped && !audio?.ended) callbacks.onPause?.() }
      audio.onended  = () => {
        releaseActive()
        callbacks.onEnd?.()
      }

      await audio.play()
    } catch (err) {
      if (!stopped) {
        console.error('[TTS]', err)
        releaseActive()
        callbacks.onEnd?.()   // reset UI to idle if load/play fails
      }
    }
  })()

  return {
    pause:  () => audio?.pause(),
    resume: () => { audio?.play().catch(() => {}) },
    stop:   () => {
      stopped = true
      releaseActive()
      callbacks.onEnd?.()   // drive UI back to idle immediately
    },
    replay: () => speak(text, callbacks),
  }
}

'use client'

import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DataCard from '@/components/DataCard'
import { Project } from '@/lib/supabase'
import { speak, TtsControls } from '@/lib/tts'

// ─── Types ────────────────────────────────────────────────────────────────────

type SpeechRecognitionEvent = Event & {
  results: { length: number; [i: number]: { [i: number]: { transcript: string } } }
}
type SpeechRecognitionErrorEvent = Event & { error: string }
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:    (() => void) | null
  start(): void; stop(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

interface Message {
  role: 'user' | 'assistant'
  content: string
  project?: Project | null
  fromVoice?: boolean
}

type Screen    = 'landing' | 'assistant'
type VoiceMode = 'idle' | 'recording'
type TtsStatus = 'idle' | 'playing' | 'paused'
type OrbState  = 'idle' | 'recording' | 'thinking' | 'speaking'

// ─── FAQ river bubble data ────────────────────────────────────────────────────
// topPct: % from top within sky container (capped at ~40% of screen)
// layer 0=back(slow,transparent) 1=mid 2=front(faster,opaque)

const FAQ_BUBBLE_DATA = [
  { text: 'Units left in Berkeley Square?', layer: 0, topPct:  7, dir: 'rtl', dur: 44, delay: -8  },
  { text: 'Payment plan?',                  layer: 1, topPct: 25, dir: 'ltr', dur: 29, delay: -21 },
  { text: 'Cheapest project?',              layer: 0, topPct: 55, dir: 'ltr', dur: 40, delay: -33 },
  { text: 'Is it VAT inclusive?',           layer: 1, topPct: 10, dir: 'rtl', dur: 27, delay: -5  },
  { text: 'Rental yield?',                  layer: 2, topPct: 70, dir: 'ltr', dur: 22, delay: -12 },
  { text: 'Handover date?',                 layer: 1, topPct: 40, dir: 'rtl', dur: 33, delay: -25 },
  { text: 'Marafid service charge?',        layer: 0, topPct: 18, dir: 'ltr', dur: 38, delay: -14 },
  { text: 'Sold out?',                      layer: 2, topPct: 82, dir: 'rtl', dur: 20, delay: -7  },
  { text: 'English · हिंदी',              layer: 1, topPct: 48, dir: 'ltr', dur: 31, delay: -18 },
] as const

// Per-layer visual properties
const LAYER_PROPS = [
  // back: small, transparent, behind orb glow
  { fontSize: 11, colorOp: 0.62, z: 2 },
  // mid: normal
  { fontSize: 13, colorOp: 0.82, z: 3 },
  // front: larger, sharper, can overlap orb rings
  { fontSize: 14, colorOp: 0.96, z: 6 },
]

// ─── FAQ river bubbles ────────────────────────────────────────────────────────

function FaqBubbles({ visible }: { visible: boolean }) {
  return (
    // Sky zone: top 42% of screen, clipped so bubbles stay above the skyline
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '42%',
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.9s ease',
        zIndex: 0,
      }}
    >
      {FAQ_BUBBLE_DATA.map((b, i) => {
        const lp = LAYER_PROPS[b.layer]
        // Outer div: X travel only (linear). Layer max-opacity applied here so
        // the inner fadeBubble (0→1→1→0) multiplies against it correctly.
        // Inner div: sine-wave Y undulation + fade envelope.
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${b.topPct}%`,
              left: 0,
              animation: `${b.dir === 'rtl' ? 'riverXRTL' : 'riverXLTR'} ${b.dur}s linear ${b.delay}s infinite`,
              zIndex: lp.z,
              opacity: lp.colorOp,
            }}
          >
            <div style={{
              // waveY period fixed at 10s → 2–4 sine cycles per bubble pass
              animation: `waveY 10s ease-in-out ${b.delay}s infinite, fadeBubble ${b.dur}s linear ${b.delay}s infinite`,
            }}>
              <span
                className={`speech-bubble${b.dir === 'rtl' ? ' speech-bubble-rtl' : ''}`}
                style={{ fontSize: lp.fontSize, color: 'rgba(255,255,255,0.92)' }}
              >
                {b.text}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Orb glow overlay (listening + speaking states) ───────────────────────────

function OrbGlow({
  orbState,
  audioLevel,
  orbSize,
}: {
  orbState: OrbState
  audioLevel: number
  orbSize: number
}) {
  // Only show full glow + rings while actively recording (listening).
  // Thinking gets a faint rim only. Speaking/idle: nothing.
  const isRec      = orbState === 'recording'
  const isThinking = orbState === 'thinking'
  if (!isRec && !isThinking) return null

  const ringBase = orbSize + 16

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: orbSize, height: orbSize,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {/* Rim glow — strong while recording, faint while thinking */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: isRec
          ? `2px solid rgba(120,170,255,${0.75 + audioLevel * 0.25})`
          : '1px solid rgba(120,170,255,0.2)',
        boxShadow: isRec
          ? `0 0 ${18 + audioLevel * 30}px ${6 + audioLevel * 14}px rgba(80,140,255,${0.28 + audioLevel * 0.3}),
             0 0 ${50 + audioLevel * 40}px rgba(60,110,255,${0.14 + audioLevel * 0.16}),
             inset 0 0 ${12 + audioLevel * 20}px rgba(100,160,255,${0.12 + audioLevel * 0.18})`
          : '0 0 12px 3px rgba(80,140,255,0.1)',
        transition: isRec ? 'all 0.1s ease' : 'all 0.5s ease',
      }} />

      {/* Expanding rings — ONLY while recording */}
      {isRec && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: ringBase, height: ringBase,
          borderRadius: '50%',
          border: `1px solid rgba(100,155,255,${0.45 + audioLevel * 0.35})`,
          animation: 'expandRing 1.4s ease-out infinite',
          transition: 'border-color 0.1s ease',
        }} />
      )}
      {isRec && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: ringBase, height: ringBase,
          borderRadius: '50%',
          border: `1px solid rgba(100,155,255,${0.28 + audioLevel * 0.22})`,
          animation: 'expandRing 1.4s ease-out 0.5s infinite',
        }} />
      )}

      {/* Bloom — strong while recording, absent while thinking */}
      {isRec && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: orbSize * 2, height: orbSize * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(60,110,255,${0.12 + audioLevel * 0.2}) 0%, transparent 65%)`,
          filter: 'blur(16px)',
          transition: 'all 0.12s ease',
        }} />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [screen, setScreen]                       = useState<Screen>('landing')
  const [landingHovered, setLandingHovered]       = useState(false)

  // Chat
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Voice
  const [voiceMode, setVoiceMode]             = useState<VoiceMode>('idle')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [audioLevel, setAudioLevel]           = useState(0)

  // TTS
  const [ttsStatus, setTtsStatus]       = useState<TtsStatus>('idle')
  const [activeTtsIdx, setActiveTtsIdx] = useState<number | null>(null)

  // Refs
  const recognitionRef      = useRef<SpeechRecognitionInstance | null>(null)
  const audioCtxRef         = useRef<AudioContext | null>(null)
  const analyserRef         = useRef<AnalyserNode | null>(null)
  const streamRef           = useRef<MediaStream | null>(null)
  const animFrameRef        = useRef<number>(0)
  const ttsRef              = useRef<TtsControls | null>(null)
  const latestTranscriptRef = useRef('')
  const stoppingRef         = useRef(false)

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last.fromVoice) startTts(last.content, messages.length - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // ── Core send ──────────────────────────────────────────────────────────────

  async function sendMessage(question: string, inputType: 'text' | 'voice') {
    if (!question.trim() || loading) return
    setError(null)
    const outgoing: Message[] = [
      ...messages,
      { role: 'user', content: question, fromVoice: inputType === 'voice' },
    ]
    setMessages(outgoing)
    setLoading(true)
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputType,
          messages: outgoing.map(({ role, content }) => ({ role, content })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Request failed.')
        setMessages((prev) => prev.slice(0, -1))
        return
      }
      setMessages([
        ...outgoing,
        { role: 'assistant', content: data.answer, project: data.project ?? null, fromVoice: inputType === 'voice' },
      ])
    } catch {
      setError('Network error — please check your connection.')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleTextSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setInput('')
    sendMessage(q, 'text')
  }

  // ── Voice ──────────────────────────────────────────────────────────────────

  async function startRecording() {
    setError(null)
    stoppingRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx  = new AudioContext()
      audioCtxRef.current = audioCtx
      const source    = audioCtx.createMediaStreamSource(stream)
      const analyser  = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserRef.current = analyser
      const dataArr = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        animFrameRef.current = requestAnimationFrame(tick)
        analyser.getByteFrequencyData(dataArr)
        setAudioLevel(dataArr.reduce((s, v) => s + v, 0) / dataArr.length / 255)
      }
      tick()
      const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>
      const Ctor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
      if (!Ctor) throw new Error('SpeechRecognition not available')
      const rec = new Ctor()
      rec.lang           = 'en-IN'
      rec.continuous     = false
      rec.interimResults = true
      recognitionRef.current = rec
      rec.onresult = (event: SpeechRecognitionEvent) => {
        const text = event.results[event.results.length - 1][0].transcript
        latestTranscriptRef.current = text
        setVoiceTranscript(text)
      }
      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'aborted') setError(`Speech recognition error: ${event.error}`)
        stopRecording()
      }
      rec.onend = () => stopRecording()
      rec.start()
      setVoiceMode('recording')
      setVoiceTranscript('')
      latestTranscriptRef.current = ''
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('allowed')
          ? 'Microphone access denied — please allow it in your browser and try again.'
          : `Could not start recording: ${msg}`
      )
    }
  }

  function stopRecording() {
    if (stoppingRef.current) return
    stoppingRef.current = true
    recognitionRef.current?.stop()
    recognitionRef.current = null
    cancelAnimationFrame(animFrameRef.current)
    setAudioLevel(0)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current  = null
    const transcript = latestTranscriptRef.current.trim()
    latestTranscriptRef.current = ''
    setVoiceTranscript('')
    setVoiceMode('idle')
    if (transcript) sendMessage(transcript, 'voice')
    else setError('No speech detected — please try again.')
  }

  function handleOrbClick() {
    if (loading || ttsStatus !== 'idle') return
    if (voiceMode === 'idle') startRecording()
    else stopRecording()
  }

  // ── TTS ────────────────────────────────────────────────────────────────────

  function startTts(text: string, idx: number) {
    ttsRef.current?.stop()
    setActiveTtsIdx(idx)
    setTtsStatus('playing')
    ttsRef.current = speak(text, {
      onEnd:    () => { setTtsStatus('idle'); setActiveTtsIdx(null) },
      onPause:  () => setTtsStatus('paused'),
      onResume: () => setTtsStatus('playing'),
    })
  }

  function togglePause() {
    if (ttsStatus === 'playing') ttsRef.current?.pause()
    else if (ttsStatus === 'paused') ttsRef.current?.resume()
  }

  function stopTts() {
    ttsRef.current?.stop()
    setTtsStatus('idle')
    setActiveTtsIdx(null)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const orbState: OrbState =
    voiceMode === 'recording' ? 'recording'
    : loading              ? 'thinking'
    : ttsStatus !== 'idle' ? 'speaking'
    : 'idle'

  const isRec       = orbState === 'recording'
  const hasMessages = messages.length > 0

  // FAQ bubbles visible when idle with no conversation and not recording
  const bubblesVisible = !hasMessages && !isRec

  // ── LANDING SCREEN ─────────────────────────────────────────────────────────

  if (screen === 'landing') {
    // ── Position / size constants — all values are % of viewport ─────────────
    //
    // CLICK ZONE (full orb area — keep large so any click on the orb works)
    // ORB_LEFT / ORB_TOP  center of the orb in the PNG (object-fit:cover)
    // ORB_SIZE            diameter of the clickable circle
    const ORB_LEFT = '55%'
    const ORB_TOP  = '46%'
    const ORB_SIZE = 'clamp(260px, 28vw, 420px)'

    // HOVER GLOW RING (tight circle around the R logo only)
    // The R logo is centered inside the orb, so RING_LEFT/RING_TOP start equal
    // to ORB_LEFT/ORB_TOP. Nudge them independently if the ring drifts off the R.
    const RING_LEFT = '62%'                        // adjust left/right: lower % = left, higher % = right
    const RING_TOP  = '43%'                        // adjust up/down:    lower % = up,   higher % = down
    const RING_SIZE = 'clamp(200px, 17vw, 265px)' // diameter of the visible glow ring
    // ─────────────────────────────────────────────────────────────────────────

    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a10' }}>

        {/* Static full-scene background */}
        <img
          src="/landing.png.png"
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            zIndex: 0,
          }}
        />

        {/* Nav — transparent so the baked-in PNG text shows through */}
        <nav style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          zIndex: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 26px',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'transparent' }}>
            Rechitta
          </span>
          <span style={{ fontSize: 11, color: 'transparent', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Dubai Property AI
          </span>
        </nav>

        {/* Hover glow ring — centered on the R logo, smaller than the full orb */}
        <div style={{
          position: 'absolute',
          top: RING_TOP, left: RING_LEFT,
          transform: 'translate(-50%, -50%)',
          width: RING_SIZE, height: RING_SIZE,
          borderRadius: '50%',
          border: `1.5px solid rgba(160,200,255,${landingHovered ? 0.65 : 0})`,
          boxShadow: landingHovered
            ? '0 0 36px 12px rgba(80,140,255,0.2), 0 0 80px rgba(60,100,255,0.1)'
            : 'none',
          transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
          pointerEvents: 'none',
          zIndex: 10,
        }} />

        {/* Click zone — full orb size so the whole sphere is clickable */}
        <div
          onMouseEnter={() => setLandingHovered(true)}
          onMouseLeave={() => setLandingHovered(false)}
          onClick={() => setScreen('assistant')}
          style={{
            position: 'absolute',
            top: ORB_TOP, left: ORB_LEFT,
            transform: 'translate(-50%, -50%)',
            width: ORB_SIZE, height: ORB_SIZE,
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 15,
          }}
        />
      </div>
    )
  }

  // ── ASSISTANT SCREEN ───────────────────────────────────────────────────────

  // Glow ring size (matches visual orb diameter in the video)
  const ORB_GLOW_PX = 220

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>

      {/* Fullscreen video background */}
      <video
        src="/assistant-orb.mp4.mp4"
        autoPlay muted loop playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          zIndex: 0,
        }}
      />

      {/* Subtle dark veil — improves text readability without killing the scene */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.2)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* FAQ bubbles — sky zone, top 42%, river flow */}
      <FaqBubbles visible={bubblesVisible} />

      {/* Nav */}
      <nav style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        zIndex: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 22px',
        background: hasMessages ? 'rgba(0,0,0,0.35)' : 'transparent',
        backdropFilter: hasMessages ? 'blur(10px)' : 'none',
        borderBottom: hasMessages ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.7s ease, border-color 0.7s ease',
      }}>
        <button
          onClick={() => { setScreen('landing') }}
          style={{
            fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.92)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          Rechitta
        </button>
        <span style={{ fontSize: 10, color: 'rgba(200,220,255,0.38)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Dubai Property AI
        </span>
      </nav>

      {/* ── Orb click zone + glow overlay — centered, large enough to cover full orb ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 8,
          // Explicit size: large enough to cover the entire visible orb in the video.
          // The glow rings (ORB_GLOW_PX) are smaller and centered inside this zone.
          width: 'clamp(300px, 44vmin, 540px)',
          height: 'clamp(300px, 44vmin, 540px)',
        }}
      >
        {/* Glow rings — centered within the wrapper via OrbGlow's own positioning */}
        <OrbGlow orbState={orbState} audioLevel={audioLevel} orbSize={ORB_GLOW_PX} />

        {/* Click zone fills the full wrapper — anywhere on the orb works */}
        <div
          onClick={handleOrbClick}
          title={isRec ? 'Tap to stop' : 'Tap to speak'}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            cursor: loading ? 'default' : 'pointer',
          }}
        />
      </div>

      {/* Status label — always visible, tells user what's happening */}
      <div style={{
        position: 'absolute',
        top: 'calc(50% + 136px)', left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9,
        pointerEvents: 'none',
        textAlign: 'center',
      }}>
        <span style={{
          display: 'block',
          fontSize: 11,
          color: isRec
            ? 'rgba(180,210,255,0.9)'
            : orbState === 'thinking' ? 'rgba(180,210,255,0.65)'
            : 'rgba(255,255,255,0.35)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontStyle: 'italic',
          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
          transition: 'color 0.4s ease',
        }}>
          {isRec && voiceTranscript
            ? `"${voiceTranscript.slice(0, 44)}${voiceTranscript.length > 44 ? '…' : ''}"`
            : orbState === 'recording' ? 'Listening…'
            : orbState === 'thinking'  ? 'Thinking…'
            : 'Tap to speak'}
        </span>
      </div>

      {/* ── Chat messages overlay ── */}
      {hasMessages && (
        <div style={{
          position: 'absolute',
          top: 64, // below nav
          bottom: 80, // above input
          left: 0, right: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 7,
          padding: '12px 16px',
          // subtle gradient to fade messages into the scene at top/bottom
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 6%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 6%, black 92%, transparent 100%)',
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'fadeInUp 0.3s ease both',
              }}>
                {msg.role === 'user' ? (
                  <div style={{
                    maxWidth: '76%',
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    borderRadius: '18px 18px 4px 18px',
                    padding: '10px 15px',
                    fontSize: 14, lineHeight: 1.55,
                    color: 'rgba(255,255,255,0.92)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  }}>
                    {msg.fromVoice && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(180,210,255,0.55)', marginBottom: 4 }}>
                        <IconMic size={9} /> Voice
                      </span>
                    )}
                    {msg.content}
                  </div>
                ) : (
                  <div style={{ maxWidth: '82%', width: '100%' }}>
                    <div style={{
                      background: 'rgba(4,8,22,0.72)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '18px 18px 18px 4px',
                      padding: '13px 16px',
                      fontSize: 14, lineHeight: 1.65,
                      color: 'rgba(255,255,255,0.88)',
                    }}>
                      <span style={{ display: 'block', fontSize: 10, color: 'rgba(140,180,255,0.55)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 9 }}>
                        Rechitta
                      </span>
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-p:leading-relaxed prose-strong:text-white prose-strong:font-semibold prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5 prose-headings:text-white">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        {activeTtsIdx === i ? (
                          <>
                            <button onClick={togglePause} style={ttsBtnStyle} title={ttsStatus === 'playing' ? 'Pause' : 'Resume'}>
                              {ttsStatus === 'playing' ? <IconPause /> : <IconPlay />}
                            </button>
                            <button onClick={stopTts} style={{ ...ttsBtnStyle, color: 'rgba(148,163,184,0.4)' }} title="Stop">
                              <IconStop />
                            </button>
                            <span style={{ fontSize: 11, color: 'rgba(140,180,255,0.5)' }}>
                              {ttsStatus === 'playing' ? 'Speaking…' : 'Paused'}
                            </span>
                          </>
                        ) : (
                          <button onClick={() => startTts(msg.content, i)} style={{ ...ttsBtnStyle, display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(148,163,184,0.35)' }}>
                            <IconSpeaker /><span style={{ fontSize: 11 }}>Listen</span>
                          </button>
                        )}
                      </div>
                    </div>
                    {msg.project && <DataCard project={msg.project} />}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'fadeInUp 0.3s ease both' }}>
                <div style={{ background: 'rgba(4,8,22,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px 18px 18px 4px', padding: '13px 16px' }}>
                  <span style={{ display: 'block', fontSize: 10, color: 'rgba(140,180,255,0.55)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 9 }}>Rechitta</span>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map((d) => (
                      <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(100,155,255,0.55)', animation: `thinkingDot 1.2s ease-in-out ${d * 160}ms infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(30,4,4,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 14, padding: '10px 14px', fontSize: 13, color: 'rgba(252,165,165,0.82)', animation: 'fadeInUp 0.3s ease both' }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Error when no messages yet */}
      {error && !hasMessages && (
        <div style={{
          position: 'absolute',
          bottom: 100, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 12,
          maxWidth: 480,
          background: 'rgba(30,4,4,0.8)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14,
          padding: '10px 16px', fontSize: 13, color: 'rgba(252,165,165,0.85)',
          textAlign: 'center',
          animation: 'fadeInUp 0.3s ease both',
        }}>
          {error}
        </div>
      )}

      {/* ── Chat input bar — glassmorphism, bottom center ── */}
      {voiceMode === 'idle' && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex: 15,
          padding: '14px 20px 20px',
          background: hasMessages ? 'rgba(0,0,0,0.3)' : 'transparent',
          backdropFilter: hasMessages ? 'blur(12px)' : 'none',
          borderTop: hasMessages ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
          transition: 'background 0.6s ease, border-color 0.6s ease',
        }}>
          <form
            onSubmit={handleTextSubmit}
            style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 8 }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any Dubai property…"
              disabled={loading}
              className="chat-input"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 14,
                padding: '12px 18px',
                fontSize: 14,
                color: 'rgba(255,255,255,0.9)',
                opacity: loading ? 0.5 : 1,
                transition: 'border-color 0.2s ease, opacity 0.2s ease',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: '12px 20px', borderRadius: 14, flexShrink: 0,
                background: !loading && input.trim() ? 'rgba(80,130,255,0.2)' : 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${!loading && input.trim() ? 'rgba(120,170,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                color: !loading && input.trim() ? 'rgba(255,255,255,0.9)' : 'rgba(200,220,255,0.28)',
                fontSize: 14,
                cursor: !loading && input.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const ttsBtnStyle: CSSProperties = {
  background: 'none', border: 'none',
  color: 'rgba(120,175,255,0.65)',
  cursor: 'pointer', padding: 0,
  display: 'flex', alignItems: 'center',
  transition: 'color 0.2s ease',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconMic({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v4M8 23h8" />
    </svg>
  )
}
function IconSpeaker() {
  return (
    <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
}
function IconPlay() {
  return (
    <svg width={13} height={13} fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
  )
}
function IconPause() {
  return (
    <svg width={13} height={13} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}
function IconStop() {
  return (
    <svg width={12} height={12} fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>
  )
}

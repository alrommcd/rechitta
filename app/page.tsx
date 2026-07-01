'use client'

import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import dynamic from 'next/dynamic'
import DataCard from '@/components/DataCard'
import Dashboard from '@/components/Dashboard'
import LandingPage from '@/components/LandingPage'
import { Project } from '@/lib/supabase'
import { speak, TtsControls } from '@/lib/tts'

const Orb = dynamic(() => import('@/components/Orb'), { ssr: false, loading: () => null })

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

type Screen    = 'landing' | 'dashboard' | 'assistant' | 'property'
type VoiceMode = 'idle' | 'recording'
type TtsStatus = 'idle' | 'playing' | 'paused'
type OrbState  = 'idle' | 'recording' | 'thinking' | 'speaking'

// ─── Property curated content (marketing copy — NOT DB-grounded) ──────────────
// The assistant Q&A stays grounded in the DB; this panel is web-curated flavor.

const PROPERTY_CONTENT: Record<string, {
  description: string
  highlights: string[]
  questions: string[]
}> = {
  'Jacob & Co. Residences': {
    description: 'A landmark branded residence in Business Bay, crafted in collaboration with Jacob & Co. — the Swiss jeweller synonymous with ultra-luxury.',
    highlights: [
      'Exclusive collection of 23 residences',
      '60/40 plan (60% construction, 40% on handover)',
      '1–3 BR homes from 1,250 sqft',
      'Branded luxury in the heart of Business Bay',
    ],
    questions: ["What's the payment plan?", 'How many units are left?', "What's the handover date?", 'Is the price VAT-inclusive?'],
  },
  'Berkeley Square': {
    description: 'A refined contemporary development by Prestige One offering studio to 2-bedroom homes in Jumeirah Village Circle.',
    highlights: [
      '30 of 79 units still available',
      'Starting from AED 730,000',
      'Flexible 50/50 payment plan',
      'Handover date not yet confirmed',
    ],
    questions: ['How many units are left?', "What's the starting price?", 'When does it hand over?', "What's the service charge?"],
  },
  'Wadi Villas': {
    description: "An ultra-luxury villa compound nestled within Al Barari's lush botanical landscape — one of Dubai's most exclusive private addresses.",
    highlights: [
      'Ultra-rare: only 2 villas, 1 still available',
      '640 sqm per villa — square metres, not sqft',
      'Cash or 70/30 payment plan',
      "Private green enclave in Al Barari",
    ],
    questions: ['Is the villa still available?', "What's the area size?", "What's the payment plan?", 'Who is the developer?'],
  },
  'JW Marriott Residences': {
    description: 'Branded residences under the JW Marriott name in Downtown Dubai — full hotel services, prime location, and a prestigious address.',
    highlights: [
      'Fully sold out — waitlist only',
      'Downtown Dubai address',
      '2–4 BR homes from AED 2,448,000',
      'Handover Q1 2028',
    ],
    questions: ['Is there a waitlist?', "What's the starting price?", 'When is the handover?', "What's the payment plan?"],
  },
  'Ryze': {
    description: 'A community-focused development by Aum Development in Dubai Sports City — designed for quality-conscious investors at an accessible entry point.',
    highlights: [
      'Lowest entry price in the current dataset',
      'From AED 602,555 — price EXCLUDES 5% VAT',
      'Flexible 1% monthly payment plan',
      'Studio to 1 BR homes from 710 sqft',
    ],
    questions: ['Is the price VAT-inclusive?', "What's the full price with VAT?", 'How many units are left?', "What's the payment plan?"],
  },
  'Marafid': {
    description: "A large-scale Marina-fronted development by Foster Developers offering 1–2 BR homes in one of Dubai's most liquid markets.",
    highlights: [
      '153 of 223 units still available',
      'AED 18/sqft/yr service charge — the only published figure in this dataset',
      'Dubai Marina location',
      '30/70 payment plan, handover Q3 2026',
    ],
    questions: ["What's the service charge?", 'How many units are available?', "What's the payment plan?", 'When is the handover?'],
  },
}

const PROPERTY_IMAGES: Record<string, string> = {
  'Jacob & Co. Residences': 'https://www.offplan-dubai.com/wp-content/uploads/2025/10/Jacob-Co.-Residences-feature.jpg',
  'Berkeley Square':        'https://storage.dxboffplan.com/files/2025/07/Berkeley-Square-at-JVC-Dubai-13.png',
  'Wadi Villas':            'https://cdn.prod.website-files.com/659564b827305f540edfb311/6596aa0d7e2ade52da948175_Exterior_01.webp',
  'JW Marriott Residences': 'https://storage.dxboffplan.com/files/2025/10/JW-Marriott-Residences-at-Dubai-Islands-9.png',
  'Ryze':                   'https://static.propsearch.ae/dubai-locations/ryze-by-aum_2jr5j_xl.jpg',
  'Marafid':                '/marafid.jpg.jpg',
}

const DEFAULT_PROPERTY_CONTENT = {
  description: 'A premium Dubai residential development with verified data available through Rechitta.',
  highlights: ['Ask anything about this property', 'All answers grounded in verified data'],
  questions: ['How many units are left?', "What's the price?", "What's the payment plan?", 'When is handover?'],
}

// ─── FAQ river bubble data ────────────────────────────────────────────────────

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

const LAYER_PROPS = [
  { fontSize: 11, colorOp: 0.62, z: 2 },
  { fontSize: 13, colorOp: 0.82, z: 3 },
  { fontSize: 14, colorOp: 0.96, z: 6 },
]

// ─── FAQ river bubbles ────────────────────────────────────────────────────────

function FaqBubbles({ visible }: { visible: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: '42%', overflow: 'hidden',
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.9s ease',
      zIndex: 0,
    }}>
      {FAQ_BUBBLE_DATA.map((b, i) => {
        const lp = LAYER_PROPS[b.layer]
        return (
          <div key={i} style={{
            position: 'absolute', top: `${b.topPct}%`, left: 0,
            animation: `${b.dir === 'rtl' ? 'riverXRTL' : 'riverXLTR'} ${b.dur}s linear ${b.delay}s infinite`,
            zIndex: lp.z, opacity: lp.colorOp,
          }}>
            <div style={{
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

// ─── Orb glow overlay (recording + thinking states) ───────────────────────────

function OrbGlow({ orbState, audioLevel, orbSize }: {
  orbState: OrbState; audioLevel: number; orbSize: number
}) {
  const isRec      = orbState === 'recording'
  const isThinking = orbState === 'thinking'
  if (!isRec && !isThinking) return null

  const ringBase = orbSize + 16

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: orbSize, height: orbSize,
      borderRadius: '50%', pointerEvents: 'none', zIndex: 5,
    }}>
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
      {isRec && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: ringBase, height: ringBase, borderRadius: '50%',
          border: `1px solid rgba(100,155,255,${0.45 + audioLevel * 0.35})`,
          animation: 'expandRing 1.4s ease-out infinite',
          transition: 'border-color 0.1s ease',
        }} />
      )}
      {isRec && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: ringBase, height: ringBase, borderRadius: '50%',
          border: `1px solid rgba(100,155,255,${0.28 + audioLevel * 0.22})`,
          animation: 'expandRing 1.4s ease-out 0.5s infinite',
        }} />
      )}
      {isRec && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: orbSize * 2, height: orbSize * 2, borderRadius: '50%',
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
  const [screen, setScreen]                 = useState<Screen>('landing')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

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

  // Transition
  const [transitioning, setTransitioning] = useState(false)

  // Refs
  const recognitionRef      = useRef<SpeechRecognitionInstance | null>(null)
  const audioCtxRef         = useRef<AudioContext | null>(null)
  const analyserRef         = useRef<AnalyserNode | null>(null)
  const streamRef           = useRef<MediaStream | null>(null)
  const animFrameRef        = useRef<number>(0)
  const ttsRef              = useRef<TtsControls | null>(null)
  const latestTranscriptRef = useRef('')
  const stoppingRef         = useRef(false)

  // ── Navigation helpers ─────────────────────────────────────────────────────

  function navigate(to: Screen, prepare?: () => void) {
    setTransitioning(true)
    setTimeout(() => {
      prepare?.()
      setScreen(to)
      setTimeout(() => setTransitioning(false), 80)
    }, 300)
  }

  function openAssistant() {
    navigate('assistant', () => { setMessages([]); setSelectedProject(null); setError(null) })
  }

  function selectProperty(project: Project) {
    navigate('property', () => { setMessages([]); setSelectedProject(project); setError(null) })
  }

  function goToDashboard() {
    ttsRef.current?.stop()
    navigate('dashboard', () => { setTtsStatus('idle'); setActiveTtsIdx(null); setMessages([]); setSelectedProject(null); setError(null) })
  }

  function goToLanding() {
    ttsRef.current?.stop()
    navigate('landing', () => { setTtsStatus('idle'); setActiveTtsIdx(null); setMessages([]); setSelectedProject(null); setError(null) })
  }

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
      const bodyPayload: Record<string, unknown> = {
        inputType,
        messages: outgoing.map(({ role, content }) => ({ role, content })),
      }
      if (screen === 'property' && selectedProject) {
        bodyPayload.focusProjectId = selectedProject.id
      }
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
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
  const bubblesVisible = !hasMessages && !isRec

  // ── Transition overlay (shared) ────────────────────────────────────────────

  const transitionOverlay = (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#050607',
      zIndex: 99999,
      opacity: transitioning ? 1 : 0,
      pointerEvents: transitioning ? 'all' : 'none',
      transition: 'opacity 0.3s cubic-bezier(0.4,0,0.2,1)',
    }} />
  )

  // ── LANDING SCREEN ─────────────────────────────────────────────────────────

  if (screen === 'landing') {
    return (
      <>
        <LandingPage onEnterApp={() => navigate('dashboard')} />
        {transitionOverlay}
      </>
    )
  }

  // ── DASHBOARD SCREEN ───────────────────────────────────────────────────────

  if (screen === 'dashboard') {
    return (
      <>
        <Dashboard
          onOpenAssistant={openAssistant}
          onSelectProperty={selectProperty}
          onBackToLanding={goToLanding}
        />
        {transitionOverlay}
      </>
    )
  }

  // ── SHARED ASSISTANT / PROPERTY SCREEN RENDER ──────────────────────────────

  const isProperty = screen === 'property' && selectedProject !== null
  const propContent = isProperty && selectedProject
    ? (PROPERTY_CONTENT[selectedProject.project_name ?? ''] ?? DEFAULT_PROPERTY_CONTENT)
    : DEFAULT_PROPERTY_CONTENT

  // Orb sizes: property uses a smaller CSS orb, assistant uses the video-embedded one
  const ORB_GLOW_PX  = isProperty ? 150 : 220
  const PROP_STATUS_TOP = isProperty ? 'calc(50% + 96px)' : 'calc(50% + 136px)'

  // ── Message render helper ──────────────────────────────────────────────────

  function renderMessages() {
    if (!hasMessages) return null
    return (
      <div style={{
        position: 'absolute',
        top: 64, bottom: 80, left: 0, right: 0,
        overflowY: 'auto', overflowX: 'hidden',
        zIndex: 7, padding: '12px 16px',
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

          {error && hasMessages && (
            <div style={{ background: 'rgba(30,4,4,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 14, padding: '10px 14px', fontSize: 13, color: 'rgba(252,165,165,0.82)', animation: 'fadeInUp 0.3s ease both' }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    )
  }

  function renderInputBar() {
    if (voiceMode !== 'idle') return null
    return (
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15,
        padding: '14px 20px 20px',
        background: hasMessages ? 'rgba(0,0,0,0.3)' : 'transparent',
        backdropFilter: hasMessages ? 'blur(12px)' : 'none',
        borderTop: hasMessages ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.6s ease, border-color 0.6s ease',
      }}>
        <form onSubmit={handleTextSubmit} style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 8 }}>
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
              borderRadius: 14, padding: '12px 18px',
              fontSize: 14, color: 'rgba(255,255,255,0.9)',
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
              fontSize: 14, cursor: !loading && input.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
            }}
          >Send</button>
        </form>
      </div>
    )
  }

  // ── ASSISTANT / PROPERTY SCREEN ────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>

      {/* Subtle ambient gradient — both screens */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 55% 45%, rgba(80,10,120,0.06) 0%, transparent 60%)',
        zIndex: 0,
      }} />

      {/* Subtle dark veil */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.2)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* FAQ bubbles — general assistant only */}
      {!isProperty && <FaqBubbles visible={bubblesVisible} />}

      {/* Nav */}
      <nav style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 22px',
        background: hasMessages ? 'rgba(0,0,0,0.35)' : 'transparent',
        backdropFilter: hasMessages ? 'blur(10px)' : 'none',
        borderBottom: hasMessages ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'background 0.7s ease, border-color 0.7s ease',
      }}>
        <button
          onClick={isProperty ? goToDashboard : goToLanding}
          style={{
            fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.92)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {isProperty ? '← Dashboard' : 'Rechitta'}
        </button>
        {isProperty && selectedProject && (
          <span style={{
            fontSize: 11, color: 'rgba(140,178,255,0.45)',
            letterSpacing: '0.08em',
          }}>
            {selectedProject.project_name}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'rgba(200,220,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Dubai Property AI
        </span>
      </nav>

      {/* Property left panel — blended into scene, hidden once chat starts */}
      {isProperty && selectedProject && !hasMessages && (
        <div style={{
          position: 'absolute',
          left: '5%', top: '50%',
          transform: 'translateY(-50%)',
          width: '30%', zIndex: 4,
          maskImage: 'linear-gradient(to right, black 45%, transparent 95%)',
          WebkitMaskImage: 'linear-gradient(to right, black 45%, transparent 95%)',
          animation: 'fadeInUp 0.55s ease both',
          pointerEvents: 'none',
        }}>
          {/* Property image */}
          {PROPERTY_IMAGES[selectedProject.project_name ?? ''] && (
            <div style={{
              width: '100%', height: 148, overflow: 'hidden',
              borderRadius: 10, marginBottom: 14, flexShrink: 0,
            }}>
              <img
                src={PROPERTY_IMAGES[selectedProject.project_name ?? '']}
                alt={selectedProject.project_name ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
              />
            </div>
          )}

          <p style={{
            margin: '0 0 6px', fontSize: 9.5,
            color: 'rgba(100,155,255,0.48)',
            letterSpacing: '0.13em', textTransform: 'uppercase',
          }}>
            {selectedProject.developer ?? '—'} · {selectedProject.location ?? '—'}
          </p>
          <h2 style={{
            margin: '0 0 12px', fontSize: 21, fontWeight: 700,
            color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.025em', lineHeight: 1.22,
          }}>
            {selectedProject.project_name}
          </h2>
          <p style={{
            margin: '0 0 18px', fontSize: 13,
            color: 'rgba(180,210,255,0.48)', lineHeight: 1.72,
          }}>
            {propContent.description}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {propContent.highlights.map((h, i) => (
              <li key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 12, color: 'rgba(160,195,255,0.4)',
              }}>
                <span style={{ color: 'rgba(80,140,255,0.4)', flexShrink: 0, marginTop: 1 }}>·</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Orb click zone + glow — centered */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 8,
        width: isProperty ? ORB_GLOW_PX : 'clamp(300px, 44vmin, 540px)',
        height: isProperty ? ORB_GLOW_PX : 'clamp(300px, 44vmin, 540px)',
      }}>
        <OrbGlow orbState={orbState} audioLevel={audioLevel} orbSize={ORB_GLOW_PX} />

        {/* Three.js orb — both assistant and property screens */}
        <Orb
          style={{
            position: 'absolute', inset: 0,
            width: 'auto', height: 'auto',
            animation: 'orbFloat 4.5s ease-in-out infinite',
          }}
        />
        {/* Transparent click zone — canvas is pointer-events:none so this fires */}
        <div
          onClick={handleOrbClick}
          title={isRec ? 'Tap to stop' : 'Tap to speak'}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            cursor: loading ? 'default' : 'pointer',
            zIndex: 10,
          }}
        />
      </div>

      {/* Status label */}
      <div style={{
        position: 'absolute',
        top: PROP_STATUS_TOP, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9, pointerEvents: 'none', textAlign: 'center',
      }}>
        <span style={{
          display: 'block', fontSize: 11,
          color: isRec
            ? 'rgba(180,210,255,0.9)'
            : orbState === 'thinking' ? 'rgba(180,210,255,0.65)'
            : 'rgba(255,255,255,0.35)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
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

      {/* Suggested question chips — property screen only, before first message */}
      {isProperty && !hasMessages && (
        <div style={{
          position: 'absolute',
          top: 'calc(50% + 124px)', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9,
          display: 'flex', flexWrap: 'wrap', gap: 7,
          justifyContent: 'center', maxWidth: 420,
          animation: 'fadeInUp 0.5s ease 0.18s both',
        }}>
          {propContent.questions.map((q, i) => (
            <button
              key={i}
              onClick={() => { if (!loading) sendMessage(q, 'text') }}
              disabled={loading}
              style={{
                padding: '6px 14px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(180,210,255,0.58)',
                fontSize: 11.5, cursor: loading ? 'default' : 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      {renderMessages()}

      {/* Standalone error (no messages yet) */}
      {error && !hasMessages && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 12, maxWidth: 480,
          background: 'rgba(30,4,4,0.8)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14,
          padding: '10px 16px', fontSize: 13, color: 'rgba(252,165,165,0.85)',
          textAlign: 'center', animation: 'fadeInUp 0.3s ease both',
        }}>
          {error}
        </div>
      )}

      {/* Input bar */}
      {renderInputBar()}

      {transitionOverlay}
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

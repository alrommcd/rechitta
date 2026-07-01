'use client'

import { useState, useEffect, useRef, CSSProperties } from 'react'
import dynamic from 'next/dynamic'

const Orb = dynamic(() => import('./Orb'), { ssr: false, loading: () => null })

interface Props {
  onEnterApp: () => void
}

const SERIF = "var(--font-playfair, 'Georgia', 'Times New Roman', serif)"
const LANG_WORDS = ['中文', 'हिंदी', 'العربية', 'Русский', 'Español', 'Français', '日本語', 'Deutsch']

// ─── Helper ───────────────────────────────────────────────────────────────────

function reveal(visible: boolean, delay = 0): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0px) scale(1)' : 'translateY(36px) scale(0.97)',
    transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function useCounter(target: number, triggered: boolean, duration = 1800) {
  const [val, setVal] = useState(0)
  const fired = useRef(false)
  useEffect(() => {
    if (!triggered || fired.current || target === 0) return
    fired.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setVal(Math.round((1 - (1 - t) ** 3) * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [triggered, target, duration])
  return target === 0 ? 0 : val
}

// ─── Waveform "Talk to Rechitta" tag ─────────────────────────────────────────

function WaveformTag({ onClick, pill = false }: { onClick: () => void; pill?: boolean }) {
  const [hov, setHov] = useState(false)

  if (pill) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onClick}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: hov ? 'rgba(240,244,255,0.96)' : 'rgba(255,255,255,0.94)',
            borderRadius: 32, padding: '13px 26px',
            cursor: 'pointer', border: 'none', outline: 'none',
            color: '#0a0a18', fontSize: 13.5, fontWeight: 600, letterSpacing: '0.01em',
            boxShadow: hov ? '0 6px 28px rgba(0,0,0,0.35)' : '0 2px 14px rgba(0,0,0,0.25)',
            transition: 'background 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          Talk to Rechitta →
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.55)' }} />
          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Live Now</span>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        background: hov ? 'rgba(48,100,255,0.12)' : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${hov ? 'rgba(80,140,255,0.26)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 30, padding: '8px 17px 8px 12px',
        cursor: 'pointer', color: 'rgba(178,218,255,0.88)',
        fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
        whiteSpace: 'nowrap', outline: 'none',
        boxShadow: hov ? '0 0 20px rgba(40,90,255,0.12)' : 'none',
        transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 14 }}>
        {[3,8,13,8,3,10,5,8].map((h, i) => (
          <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: 'rgba(105,172,255,0.82)', animation: `waveBar 0.85s ease-in-out ${i * 0.09}s infinite alternate` }} />
        ))}
      </div>
      Talk to Rechitta →
    </button>
  )
}

// ─── Floor ruler ─────────────────────────────────────────────────────────────

function FloorRuler() {
  const marks = ['ROOF', '82F', '62F', '42F', 'G']
  return (
    <div style={{ position: 'absolute', right: 18, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', padding: '80px 0 56px', pointerEvents: 'none', zIndex: 10 }}>
      <div style={{ position: 'absolute', right: 0, top: 80, bottom: 56, width: 1, background: 'rgba(255,255,255,0.055)' }} />
      {marks.map((m, i) => (
        <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
          <span style={{ fontSize: 7.5, letterSpacing: '0.1em', color: i === 0 ? 'rgba(80,140,255,0.5)' : 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-geist-mono, monospace)' }}>{m}</span>
          <div style={{ width: i === 0 ? 8 : 4, height: 1, background: i === 0 ? 'rgba(60,120,255,0.45)' : 'rgba(255,255,255,0.1)' }} />
          {i === 0 && <div style={{ position: 'absolute', right: -5, width: 5, height: 5, borderRadius: '50%', background: 'rgba(60,130,255,0.75)', boxShadow: '0 0 8px rgba(60,130,255,0.5)' }} />}
        </div>
      ))}
    </div>
  )
}

// ─── Section background ───────────────────────────────────────────────────────

function SectionBg({ tint, position = 'center' }: { tint: string; position?: string }) {
  return (
    <>
      <img
        src="/dubai.jpg"
        alt=""
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, filter: 'brightness(0.1) saturate(0.18)', zIndex: 0 }}
      />
      <div style={{ position: 'absolute', inset: 0, background: tint, zIndex: 1 }} />
    </>
  )
}

// ─── Stat item ────────────────────────────────────────────────────────────────

function StatItem({ num, label, suffix = '', isString = false, strVal = '', triggered }: {
  num: number; label: string; suffix?: string; isString?: boolean; strVal?: string; triggered: boolean
}) {
  const count = useCounter(num, triggered && !isString)
  const display = isString ? strVal : (count >= 1000 ? count.toLocaleString() : String(count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {display}{suffix}
      </span>
      <span style={{ fontSize: 9, color: '#8A8A8A', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

function StatDivider() {
  return <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 28px', alignSelf: 'stretch' }} />
}

// ─── Phone mockup (Section 4) ────────────────────────────────────────────────

function PhoneMockup({ onOrbClick }: { onOrbClick: () => void }) {
  return (
    <div style={{ width: 278, height: 574, borderRadius: 44, flexShrink: 0, background: '#07080f', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* notch */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 96, height: 26, background: '#07080f', borderRadius: '0 0 16px 16px', zIndex: 10 }} />

      {/* status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 5px', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>9:41</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 9 }}>
            {[3,5,7,9].map((h,i) => <div key={i} style={{ width: 2.5, height: h, background: 'rgba(255,255,255,0.82)', borderRadius: 0.5 }} />)}
          </div>
          <div style={{ width: 19, height: 10, borderRadius: 2.5, border: '1.5px solid rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', padding: '1.5px 1.5px' }}>
            <div style={{ width: '75%', height: '100%', background: 'rgba(255,255,255,0.82)', borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* app nav */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '2px 16px 5px', flexShrink: 0 }}>
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', lineHeight: 1, marginRight: 8 }}>←</span>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.78)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>The Overview</span>
        <div style={{ width: 18 }} />
      </div>

      {/* progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: '42%', background: 'linear-gradient(90deg, rgba(48,100,255,0.65), rgba(80,150,255,0.3))' }} />
      </div>

      {/* sub-labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 16px', flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.26)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>The Overview</span>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.26)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Handover 2027</span>
      </div>

      {/* project title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 16px 9px', flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>JW Marriott</span>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>↻</div>
      </div>

      {/* hero image */}
      <div style={{ flex: 1, margin: '0 12px', borderRadius: 14, overflow: 'hidden', position: 'relative' }}>
        <img
          src="https://storage.dxboffplan.com/files/2025/10/JW-Marriott-Residences-at-Dubai-Islands-9.png"
          alt="JW Marriott Residences"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)' }} />
        <span style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 8.5, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic' }}>JW Marriott · Dubai Islands</span>
        <div style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[true,false,false,false].map((a, i) => <div key={i} style={{ width: 3.5, height: a ? 12 : 4, borderRadius: 2, background: a ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)' }} />)}
        </div>
      </div>

      {/* caption */}
      <p style={{ margin: '7px 14px 3px', fontSize: 9, fontStyle: 'italic', color: 'rgba(255,255,255,0.26)', lineHeight: 1.5, textAlign: 'center', flexShrink: 0 }}>
        "I've curated the most exclusive availability within JW Marriott Residences."
      </p>

      {/* playback bar */}
      <div style={{ margin: '3px 14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 30, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 18px', flexShrink: 0 }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="rgba(255,255,255,0.42)"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        <div
          onClick={onOrbClick}
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            background: 'radial-gradient(circle, rgba(150,30,180,0.5) 0%, rgba(80,10,120,0.28) 100%)',
            border: '1px solid rgba(180,50,220,0.32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px 4px rgba(150,40,180,0.3)',
          }}
        >
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {[3, 8, 12, 8, 3].map((h, i) => (
              <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: 'rgba(210,120,255,0.9)', animation: `waveBar 0.85s ease-in-out ${i * 0.11}s infinite alternate` }} />
            ))}
          </div>
        </div>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth={2} strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LandingPage({ onEnterApp }: Props) {
  const [exiting, setExiting]     = useState(false)
  const [landingHovered, setLandingHovered] = useState(false)

  // Language cycling (Section 2)
  const [langIdx, setLangIdx]     = useState(0)
  const [langFade, setLangFade]   = useState(false)

  // Reveal refs — low threshold so content starts animating as section enters
  const s2 = useReveal(0.04)
  const s3 = useReveal(0.04)
  const s4 = useReveal(0.04)

  const heroRef        = useRef<HTMLElement>(null)
  const floatingOrbRef = useRef<HTMLDivElement>(null)
  const fogRef         = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setLangFade(true)
      setTimeout(() => { setLangIdx(i => (i + 1) % LANG_WORDS.length); setLangFade(false) }, 380)
    }, 2600)
    return () => clearInterval(id)
  }, [])

  // Scroll-driven fog/blur + floating orb travel
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const MB = reduced ? 0 : 18

    const apply = (el: HTMLElement | null, opacity: number, blur: number) => {
      if (!el) return
      el.style.opacity = opacity.toFixed(3)
      el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : ''
    }

    const onScroll = () => {
      const sy = window.scrollY
      const vh = window.innerHeight
      const vw = window.innerWidth
      const cl = (n: number) => Math.min(Math.max(n, 0), 1)
      const t1 = cl(sy / vh)
      const t2 = cl((sy - vh) / vh)
      const t3 = cl((sy - 2 * vh) / vh)

      // Section blur/fade
      apply(heroRef.current,                    1 - t1,          t1 * MB)
      apply(s2.ref.current as HTMLElement,      t1 * (1 - t2),   MB * (1 - t1) + MB * t2)
      apply(s3.ref.current as HTMLElement,      t2 * (1 - t3),   MB * (1 - t2) + MB * t3)
      apply(s4.ref.current as HTMLElement,      t3,              MB * (1 - t3))

      // Fog veil — rises and falls at each transition midpoint
      if (fogRef.current && !reduced) {
        const fog = Math.max(
          0.38 * Math.sin(t1 * Math.PI),
          0.38 * Math.sin(t2 * Math.PI),
          0.38 * Math.sin(t3 * Math.PI),
        )
        fogRef.current.style.opacity = fog.toFixed(3)
      }

      // Floating orb — single View, S2 right → S3 left, invisible on hero and S4
      const orb = floatingOrbRef.current
      if (orb) {
        const s2x = vw * 0.70   // centre-x for S2 right column
        const s3x = vw * 0.22   // centre-x for S3 left column
        const oy  = vh * 0.50   // centre-y (vertically centred)
        const R   = 150          // half of 300px orb

        const ease  = t2 < 0.5 ? 2 * t2 * t2 : 1 - Math.pow(-2 * t2 + 2, 2) / 2
        const orbX  = s2x + (s3x - s2x) * ease

        // phase1: 0 while hero is showing, ramps up only in the final stretch of S1→S2
        const phase1     = cl((t1 - 0.65) / 0.35)
        const orbOpacity = t3 > 0 ? cl(1 - t3 * 2) : phase1
        // hidden when not yet visible OR when fully faded — moves View off-screen so canvas renders nothing
        const hidden     = phase1 < 0.01 || orbOpacity < 0.01

        // Drive position via transform so getBoundingClientRect gives exact pixel coords
        const tx = hidden ? -600 : orbX - R  // left edge of 300×300 box
        const ty = oy - R                     // top edge of 300×300 box
        orb.style.transform     = `translate(${tx}px, ${ty}px)`
        orb.style.opacity       = orbOpacity.toFixed(3)
        orb.style.pointerEvents = orbOpacity > 0.3 ? 'auto' : 'none'
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [s2.ref, s3.ref, s4.ref])

  function enterApp() {
    setExiting(true)
    setTimeout(onEnterApp, 480)
  }

  const ORB_LEFT = '55%'
  const ORB_TOP  = '46%'
  const ORB_SIZE = 'clamp(260px, 28vw, 420px)'
  const RING_LEFT = '62%'
  const RING_TOP  = '43%'
  const RING_SIZE = 'clamp(200px, 17vw, 265px)'

  const eyebrow: CSSProperties = { margin: '0 0 14px', fontSize: 10, color: '#8A8A8A', letterSpacing: '0.16em', textTransform: 'uppercase' }
  const bodyText: CSSProperties = { margin: '0 0 32px', fontSize: 15, color: '#B8BBC2', lineHeight: 1.76 }

  return (
    <>

      {/* ── Fog veil — outside exit-transform scope so position:fixed hits the viewport ── */}
      <div ref={fogRef} style={{ position: 'fixed', inset: 0, background: '#050607', opacity: 0, pointerEvents: 'none', zIndex: 10000 }} />

      {/* ── Floating orb — outside exit-transform scope so position:fixed hits the viewport ── */}
      <div
        ref={floatingOrbRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: 'translate(-600px, 0px)',
          width: 300, height: 300,
          zIndex: 5000,
          opacity: 0,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
        }}
      >
        <div style={{
          position: 'absolute', inset: '-25%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(130,20,180,0.22) 0%, rgba(80,10,130,0.1) 55%, transparent 72%)',
          pointerEvents: 'none',
        }} />
        <Orb size={300} count={4500} onClick={enterApp} style={{ animation: 'orbFloat 4.5s ease-in-out infinite' }} />
      </div>

      {/* Main page — transform only applied during exit so it never traps fixed children ── */}
      <div style={{
        fontFamily: 'var(--font-geist-sans, system-ui, sans-serif)',
        background: '#050607',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'scale(1.025)' : undefined,
        transition: 'opacity 0.48s ease, transform 0.48s cubic-bezier(0.4,0,0.2,1)',
      }}>

      {/* ══ SECTION 1 — HERO (original layout, static landing image) ══════════ */}
      <section ref={heroRef} style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: '#0a0a10', zIndex: 1 }}>
        <img
          src="/landing.png.png"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', zIndex: 0 }}
        />
        {/* hover ring */}
        <div style={{
          position: 'absolute', top: RING_TOP, left: RING_LEFT,
          transform: 'translate(-50%, -50%)',
          width: RING_SIZE, height: RING_SIZE, borderRadius: '50%',
          border: `1.5px solid rgba(160,200,255,${landingHovered ? 0.65 : 0})`,
          boxShadow: landingHovered ? '0 0 36px 12px rgba(80,140,255,0.2), 0 0 80px rgba(60,100,255,0.1)' : 'none',
          transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
          pointerEvents: 'none', zIndex: 10,
        }} />
        {/* invisible click zone over the orb */}
        <div
          onMouseEnter={() => setLandingHovered(true)}
          onMouseLeave={() => setLandingHovered(false)}
          onClick={enterApp}
          style={{ position: 'absolute', top: ORB_TOP, left: ORB_LEFT, transform: 'translate(-50%, -50%)', width: ORB_SIZE, height: ORB_SIZE, borderRadius: '50%', cursor: 'pointer', zIndex: 15 }}
        />
      </section>

      {/* ══ SECTION 2 — "She speaks" ════════════════════════════════════════════ */}
      <div
        ref={s2.ref}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 7vw', zIndex: 2 }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, rgba(5,6,7,1) 0%, rgba(5,6,7,0.6) 50%, rgba(5,6,7,0) 100%)', zIndex: 5, pointerEvents: 'none' }} />
        <SectionBg tint="linear-gradient(135deg, rgba(2,5,22,0.72) 0%, rgba(0,2,10,0.45) 100%)" position="center top" />

        {/* Left column */}
        <div style={{ flex: 1, maxWidth: 520, position: 'relative', zIndex: 4, paddingRight: '5vw' }}>
          <p style={{ ...eyebrow, ...reveal(s2.visible, 0) }}>40+ Languages</p>
          <h2 style={{ margin: '0 0 20px', fontFamily: SERIF, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#F4F5F7' }}>
            <span style={{ display: 'block', fontSize: 'clamp(52px, 6vw, 82px)', ...reveal(s2.visible, 80) }}>She speaks</span>
            <span style={{
              display: 'inline-block',
              fontSize: 'clamp(52px, 6vw, 82px)',
              fontStyle: 'italic',
              opacity: langFade ? 0 : (s2.visible ? 1 : 0),
              transform: langFade ? 'translateY(-6px)' : (s2.visible ? 'translateY(0)' : 'translateY(28px)'),
              filter: langFade ? 'blur(5px)' : 'blur(0)',
              transition: langFade ? 'opacity 0.38s ease, transform 0.38s ease, filter 0.38s ease' : `opacity 0.72s cubic-bezier(0.16,1,0.3,1) 160ms, transform 0.72s cubic-bezier(0.16,1,0.3,1) 160ms`,
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(160,200,255,0.85) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {LANG_WORDS[langIdx]}
            </span>
          </h2>
          <p style={{ ...bodyText, ...reveal(s2.visible, 240) }}>
            The intelligence layer sits between raw property data and every human in the deal. It reads, reasons, and responds — in the language your buyer, broker, or investor actually thinks in.
          </p>
          <div style={reveal(s2.visible, 340)}>
            <WaveformTag onClick={enterApp} />
          </div>
        </div>

        {/* Right — space for floating orb (position:fixed, rendered by canvas at z:9998) */}
        <div style={{ width: 300, height: 300, flexShrink: 0 }} />

        <FloorRuler />
      </div>

      {/* ══ SECTION 3 — "One upload. Every broker briefed." ═════════════════════ */}
      <div
        ref={s3.ref}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 7vw', zIndex: 3 }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, rgba(5,6,7,1) 0%, rgba(5,6,7,0.6) 50%, rgba(5,6,7,0) 100%)', zIndex: 5, pointerEvents: 'none' }} />
        <SectionBg tint="linear-gradient(160deg, rgba(0,2,12,0.68) 0%, rgba(4,2,18,0.55) 100%)" position="center 30%" />

        {/* Left — space for floating orb when it arrives from S2 right */}
        <div style={{ width: 300, height: 300, flexShrink: 0, marginRight: '4vw' }} />

        {/* Right column — pushed to extreme right, mirroring SPEAKS text-left layout */}
        <div style={{ width: 'min(520px, 40vw)', position: 'relative', zIndex: 4, paddingLeft: '4vw', marginLeft: 'auto' }}>
          <p style={{ ...eyebrow, ...reveal(s3.visible, 0) }}>For Developers</p>
          <h2 style={{ margin: '0 0 20px', fontFamily: SERIF, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#F4F5F7' }}>
            <span style={{ display: 'block', fontSize: 'clamp(42px, 5vw, 70px)', ...reveal(s3.visible, 80) }}>One upload.</span>
            <span style={{ display: 'block', fontSize: 'clamp(42px, 5vw, 70px)', fontStyle: 'italic', ...reveal(s3.visible, 160) }}>Every broker briefed.</span>
          </h2>
          <p style={{ ...bodyText, ...reveal(s3.visible, 240) }}>
            You brief Rechitta once. She reaches everyone — at any hour, in any language, without you in the room.
          </p>

          {/* Stat row */}
          <div style={{ display: 'flex', alignItems: 'stretch', ...reveal(s3.visible, 320) }}>
            <StatItem num={39700}  label="Brokers in Dubai"  triggered={s3.visible} />
            <StatDivider />
            <StatItem num={40}     label="Languages" suffix="+"  triggered={s3.visible} />
            <StatDivider />
            <StatItem num={0}      label="Distortion"  triggered={s3.visible} />
          </div>
          <div style={{ marginTop: 32, ...reveal(s3.visible, 420) }}>
            <WaveformTag onClick={enterApp} />
          </div>
        </div>

        <FloorRuler />
      </div>

      {/* ══ SECTION 4 — "Your private property curator." ════════════════════════ */}
      <div
        ref={s4.ref}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 7vw', zIndex: 4 }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, rgba(5,6,7,1) 0%, rgba(5,6,7,0.6) 50%, rgba(5,6,7,0) 100%)', zIndex: 5, pointerEvents: 'none' }} />
        <SectionBg tint="linear-gradient(145deg, rgba(0,2,14,0.75) 0%, rgba(3,0,12,0.55) 100%)" position="center 60%" />

        {/* Left — phone mockup */}
        <div style={{ position: 'relative', zIndex: 4, paddingRight: '6vw', ...reveal(s4.visible, 0) }}>
          <PhoneMockup onOrbClick={enterApp} />
        </div>

        {/* Right column */}
        <div style={{ flex: 1, maxWidth: 500, position: 'relative', zIndex: 4 }}>
          <p style={{ ...eyebrow, ...reveal(s4.visible, 80) }}>For Investors</p>
          <h2 style={{ margin: '0 0 20px', fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(40px, 5vw, 66px)', lineHeight: 1.1, letterSpacing: '-0.03em', color: '#F4F5F7' }}>
            <span style={reveal(s4.visible, 160)}>Your <em style={{ fontStyle: 'italic' }}>private</em> property curator.</span>
          </h2>
          <p style={{ ...bodyText, ...reveal(s4.visible, 240) }}>
            Not a listing. Not an agent. The source of truth — in your language, at any hour, without a broker call.
          </p>

          {/* Stat row */}
          <div style={{ display: 'flex', alignItems: 'stretch', ...reveal(s4.visible, 320) }}>
            <StatItem num={150}    label="Countries of Buyers" suffix="+"  triggered={s4.visible} />
            <StatDivider />
            <StatItem num={0} label="Response Time" isString strVal="<5S"  triggered={s4.visible} />
            <StatDivider />
            <StatItem num={0}      label="Forms to Fill"  triggered={s4.visible} />
          </div>
          <div style={{ marginTop: 36, ...reveal(s4.visible, 420) }}>
            <WaveformTag onClick={enterApp} />
          </div>
        </div>

        <FloorRuler />
      </div>

      </div>{/* end main page div */}
    </>
  )
}

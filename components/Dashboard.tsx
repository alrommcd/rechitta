'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Project } from '@/lib/supabase'
import { deriveStatusBadge } from '@/lib/data/properties'

const Orb = dynamic(() => import('./Orb'), { ssr: false, loading: () => null })

interface Props {
  onOpenAssistant: () => void
  onSelectProperty: (project: Project) => void
  onBackToLanding: () => void
}

// ─── Mini orb (Three.js, for dashboard CTA) ──────────────────────────────────

function MiniOrb({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 108, height: 108, borderRadius: '50%',
          boxShadow: hovered
            ? '0 0 56px 20px rgba(150,30,180,0.38), 0 0 110px rgba(100,20,150,0.22)'
            : '0 0 32px 10px rgba(120,20,160,0.22), 0 0 70px rgba(90,10,130,0.12)',
          animation: 'orbFloat 4.2s ease-in-out infinite',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        <Orb size={108} count={2000} onClick={onClick} />
      </div>
      <span style={{
        fontSize: 10, color: 'rgba(140,178,255,0.55)',
        letterSpacing: '0.13em', textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        Talk with Rechitta
      </span>
    </div>
  )
}

// ─── Analytics card ───────────────────────────────────────────────────────────

function AnalyticsCard({
  title,
  value,
  sub,
  action,
}: {
  title: string
  value: string | number
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.028)',
      border: '1px solid rgba(255,255,255,0.065)',
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <span style={{
        fontSize: 10, color: 'rgba(140,178,255,0.48)',
        letterSpacing: '0.11em', textTransform: 'uppercase',
      }}>{title}</span>
      <span style={{
        fontSize: 30, fontWeight: 700,
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: '-0.03em', lineHeight: 1.1,
      }}>{value}</span>
      {sub && (
        <span style={{ fontSize: 11.5, color: 'rgba(200,218,255,0.38)' }}>{sub}</span>
      )}
      {action}
    </div>
  )
}

// ─── Project card (carousel) ──────────────────────────────────────────────────

const CARD_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(140deg, #0f1e3c 0%, #080e22 100%)',
  2: 'linear-gradient(140deg, #0f1e30 0%, #080e1c 100%)',
  3: 'linear-gradient(140deg, #0e1e2e 0%, #081018 100%)',
  4: 'linear-gradient(140deg, #1c0e22 0%, #100812 100%)',
  5: 'linear-gradient(140deg, #0e1e12 0%, #080e0a 100%)',
  6: 'linear-gradient(140deg, #1e1c0a 0%, #100e06 100%)',
}

const PROPERTY_IMAGES: Record<string, string> = {
  'Jacob & Co. Residences': 'https://www.offplan-dubai.com/wp-content/uploads/2025/10/Jacob-Co.-Residences-feature.jpg',
  'Berkeley Square':        'https://storage.dxboffplan.com/files/2025/07/Berkeley-Square-at-JVC-Dubai-13.png',
  'Wadi Villas':            'https://cdn.prod.website-files.com/659564b827305f540edfb311/6596aa0d7e2ade52da948175_Exterior_01.webp',
  'JW Marriott Residences': 'https://storage.dxboffplan.com/files/2025/10/JW-Marriott-Residences-at-Dubai-Islands-9.png',
  'Ryze':                   'https://static.propsearch.ae/dubai-locations/ryze-by-aum_2jr5j_xl.jpg',
  'Marafid':                '/marafid.jpg.jpg',
}

function formatCardPrice(p: Project): string {
  const raw = p.starting_price ?? '—'
  const hasFrom = raw.toLowerCase().startsWith('from ')
  const prefix = hasFrom ? 'from ' : ''
  const num = hasFrom ? raw.slice(5) : raw
  const vatSuffix = p.price_currency?.includes('excl') ? '*' : ''
  return `${prefix}AED ${num}${vatSuffix}`
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const badge = deriveStatusBadge(project)
  const available = badge === 'Available'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        width: 218, flexShrink: 0,
        background: CARD_GRADIENTS[project.id] ?? CARD_GRADIENTS[1],
        border: `1px solid rgba(255,255,255,${hovered ? 0.1 : 0.055})`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.22s ease, box-shadow 0.22s ease',
        boxShadow: hovered
          ? '0 10px 36px rgba(0,0,0,0.45)'
          : '0 2px 10px rgba(0,0,0,0.22)',
        outline: 'none',
      }}
    >
      {/* Property image */}
      {PROPERTY_IMAGES[project.project_name ?? ''] ? (
        <div style={{ position: 'relative', height: 118, overflow: 'hidden' }}>
          <img
            src={PROPERTY_IMAGES[project.project_name ?? '']}
            alt={project.project_name ?? ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.45) 100%)',
          }} />
        </div>
      ) : (
        /* Fallback accent bar when no image */
        <div style={{
          height: 2,
          background: available
            ? 'linear-gradient(90deg, rgba(48,190,100,0.55), transparent)'
            : 'linear-gradient(90deg, rgba(190,48,48,0.55), transparent)',
        }} />
      )}

      <div style={{ padding: '14px 16px 16px' }}>
        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '2px 9px', borderRadius: 20,
          background: available ? 'rgba(48,190,100,0.1)' : 'rgba(190,48,48,0.1)',
          border: `1px solid ${available ? 'rgba(48,190,100,0.22)' : 'rgba(190,48,48,0.22)'}`,
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 9.5, fontWeight: 600,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: available ? 'rgba(72,220,126,0.85)' : 'rgba(220,72,72,0.85)',
          }}>{badge}</span>
        </div>

        <p style={{
          margin: '0 0 3px', fontSize: 13.5, fontWeight: 600,
          color: 'rgba(255,255,255,0.9)', lineHeight: 1.3,
        }}>{project.project_name}</p>
        <p style={{
          margin: '0 0 14px', fontSize: 10.5,
          color: 'rgba(200,218,255,0.36)',
        }}>
          {project.developer ?? '—'} · {project.location ?? '—'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{
              margin: '0 0 2px', fontSize: 9.5,
              color: 'rgba(140,178,255,0.42)',
              letterSpacing: '0.07em', textTransform: 'uppercase',
            }}>Starting</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
              {formatCardPrice(project)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{
              margin: '0 0 2px', fontSize: 9.5,
              color: 'rgba(140,178,255,0.42)',
              letterSpacing: '0.07em', textTransform: 'uppercase',
            }}>Units</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.82)' }}>
              {project.units_available ?? '—'} / {project.total_units ?? '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10, marginBottom: 3,
        background: active ? 'rgba(48,100,255,0.11)' : 'transparent',
        border: active ? '1px solid rgba(48,100,255,0.2)' : '1px solid transparent',
        color: active ? 'rgba(140,178,255,0.9)' : 'rgba(200,218,255,0.38)',
        cursor: 'pointer', fontSize: 13, fontWeight: 500,
        textAlign: 'left',
        transition: 'background 0.18s ease, color 0.18s ease',
        outline: 'none',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}
function IconProjects() {
  return (
    <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  )
}
function IconClients() {
  return (
    <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ onOpenAssistant, onSelectProperty, onBackToLanding }: Props) {
  const [projects, setProjects]         = useState<Project[]>([])
  const [loadingProjects, setLoading]   = useState(true)
  const [activeNav, setActiveNav]       = useState<'home' | 'projects' | 'clients'>('home')

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      display: 'flex', width: '100vw', height: '100vh',
      background: '#07090f',
      fontFamily: 'var(--font-geist-sans, system-ui, -apple-system, sans-serif)',
      overflow: 'hidden',
      color: 'rgba(255,255,255,0.88)',
    }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside style={{
        width: 234, flexShrink: 0,
        background: 'rgba(3,5,13,0.98)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0 20px',
        overflow: 'hidden',
      }}>
        {/* Logo — click to return to landing */}
        <div style={{ padding: '0 20px 28px' }}>
          <button
            onClick={onBackToLanding}
            title="Back to home"
            style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              boxShadow: '0 0 14px rgba(120,20,160,0.4)',
              flexShrink: 0,
            }}>
              <Orb size={32} count={300} />
            </div>
            <span style={{
              fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
              letterSpacing: '-0.025em',
            }}>Rechitta</span>
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 10px' }}>
          <NavItem active={activeNav === 'home'}     icon={<IconHome />}     label="Home"     onClick={() => setActiveNav('home')} />
          <NavItem active={activeNav === 'projects'} icon={<IconProjects />} label="Projects" onClick={() => setActiveNav('projects')} />
          <NavItem active={activeNav === 'clients'}  icon={<IconClients />}  label="Clients"  onClick={() => setActiveNav('clients')} />
        </nav>

        {/* User block */}
        <div style={{
          margin: '0 10px',
          padding: '12px 12px',
          borderTop: '1px solid rgba(255,255,255,0.055)',
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(70,120,255,0.55), rgba(36,60,180,0.55))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'rgba(180,210,255,0.9)',
          }}>OK</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{
              margin: 0, fontSize: 12, fontWeight: 600,
              color: 'rgba(255,255,255,0.78)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>Om kadam</p>
            <p style={{
              margin: 0, fontSize: 10, color: 'rgba(200,218,255,0.3)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>omkadam0501@gm…</p>
          </div>
          <button
            onClick={onBackToLanding}
            title="Back to landing"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(200,218,255,0.28)', padding: 4,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.18s ease',
              outline: 'none',
            }}
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, overflow: 'auto',
        padding: '30px 32px 36px',
        display: 'flex', flexDirection: 'column', gap: 28,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 24, fontWeight: 700,
              color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.025em',
            }}>
              Welcome back, Om kadam
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: 'rgba(200,218,255,0.3)', letterSpacing: '0.03em' }}>
              Tuesday, 1 July 2026
            </p>
          </div>
        </div>

        {/* Analytics row + Orb */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>

          {/* 2×2 analytics grid */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
            <AnalyticsCard
              title="Active Clients"
              value={14}
              action={
                <button style={{
                  marginTop: 8, padding: '4px 12px', borderRadius: 8,
                  background: 'rgba(48,100,255,0.14)',
                  border: '1px solid rgba(48,100,255,0.24)',
                  color: 'rgba(140,178,255,0.82)',
                  fontSize: 10.5, cursor: 'pointer', width: 'fit-content',
                  letterSpacing: '0.05em',
                  outline: 'none',
                }}>View All</button>
              }
            />
            <AnalyticsCard title="Rechitta Usage" value={327} sub="minutes" />
            <AnalyticsCard title="Hottest Unit" value={908} sub="Berkeley Square · 65 views" />
            <AnalyticsCard title="Units Shown" value={52} />
          </div>

          {/* Mini orb CTA */}
          <div style={{
            width: 210, flexShrink: 0,
            background: 'rgba(255,255,255,0.018)',
            border: '1px solid rgba(255,255,255,0.055)',
            borderRadius: 18,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '30px 20px',
          }}>
            <MiniOrb onClick={onOpenAssistant} />
          </div>
        </div>

        {/* Latest & Hot Projects */}
        <div>
          <h2 style={{
            margin: '0 0 14px',
            fontSize: 14, fontWeight: 600,
            color: 'rgba(255,255,255,0.62)',
            letterSpacing: '0.01em',
          }}>
            Latest &amp; Hot Projects
          </h2>

          {loadingProjects ? (
            <div style={{ display: 'flex', gap: 13 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 218, height: 158, borderRadius: 16, flexShrink: 0,
                  background: 'rgba(255,255,255,0.025)',
                  animation: 'thinkingDot 1.4s ease-in-out infinite',
                }} />
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex', gap: 13, overflowX: 'auto', paddingBottom: 10,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            }}>
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} onClick={() => onSelectProperty(p)} />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

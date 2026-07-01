'use client'

import { useState } from 'react'
import { Project } from '@/lib/supabase'

interface Props {
  project: Project
}

function fmt(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function Row({ label, value }: { label: string; value: string | null }) {
  const present = value !== null
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs uppercase tracking-widest text-blue-400/70 shrink-0 w-32 pt-0.5">
        {label}
      </span>
      <span
        className={`text-sm text-right leading-snug ${
          present ? 'text-gray-100' : 'text-gray-600 italic'
        }`}
      >
        {present ? value : 'Not available'}
      </span>
    </div>
  )
}

export default function DataCard({ project: p }: Props) {
  const [copied, setCopied] = useState(false)

  const unitsDisplay =
    p.units_available !== null && p.total_units !== null
      ? `${p.units_available} / ${p.total_units}`
      : p.units_available !== null
      ? String(p.units_available)
      : null

  const priceDisplay =
    p.starting_price !== null
      ? `${p.price_currency ? p.price_currency + ' ' : ''}${p.starting_price}`
      : null

  const shareText = [
    `Project: ${p.project_name ?? '—'}`,
    `Developer: ${p.developer ?? 'Not available'}`,
    `Units Available: ${unitsDisplay ?? 'Not available'}`,
    `Starting Price: ${priceDisplay ?? 'Not available'}`,
    `Payment Plan: ${p.payment_plan ?? 'Not available'}`,
    `Handover: ${p.handover ?? 'Not available'}`,
    `Location: ${p.location ?? 'Not available'}`,
  ].join('\n')

  function copyToClipboard() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: p.project_name ?? 'Property', text: shareText })
    } else {
      copyToClipboard()
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-blue-900/40 bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-blue-900/30 bg-blue-950/30">
        <p className="text-xs uppercase tracking-widest text-blue-400/60 mb-0.5">Property</p>
        <p className="text-base font-semibold text-white">{p.project_name ?? '—'}</p>
      </div>

      {/* Rows */}
      <div className="px-4 py-1">
        <Row label="Developer"       value={fmt(p.developer)} />
        <Row label="Units Available" value={unitsDisplay} />
        <Row label="Starting Price"  value={priceDisplay} />
        <Row label="Payment Plan"    value={fmt(p.payment_plan)} />
        <Row label="Handover"        value={fmt(p.handover)} />
        <Row label="Location"        value={fmt(p.location)} />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-white/5 flex gap-2">
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={share}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
      </div>
    </div>
  )
}

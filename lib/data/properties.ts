// Data-access layer for the `projects` table.
//
// Schema introspected 2026-07-01 — table: projects (6 rows)
// ─────────────────────────────────────────────────────────────────────────────
// Column            Type        Notes
// id                int8        PK
// project_name      text
// developer         text
// status            text        Inconsistent casing in DB: "Available" / "available" /
//                               "AVAILABLE" / "Sold Out" — derive badge from units_available
// total_units       int4
// units_available   int4
// starting_price    text        Pre-formatted string ("1,115,888", "from 730,000")
// price_currency    text|null   null for Berkeley Square (price already includes "from")
//                               "AED (excl. VAT)" for Ryze
// area_value        int4
// area_unit         text        "sqft" | "sqm" — DO NOT convert; report as-is
// payment_plan      text
// handover          text        "TBD" for Berkeley Square + Ryze; "Q2 2026"–"Q1 2028" for others
// service_charge    text|null   null for all EXCEPT Marafid: "AED 18 per sqft per year"
// rental_yield      float8|null null for ALL 6 rows
// bedrooms          text
// location          text
// notes             text
//
// NULL findings (important for grounding rules):
//   rental_yield   → null for every row — never invent a yield
//   service_charge → null for 5/6 rows; Marafid is the only published value
//   price_currency → null for Berkeley Square only
//   handover       → "TBD" (not null) for Berkeley Square and Ryze
//
// Row-level anomalies:
//   Wadi Villas     — area in sqm, not sqft (see notes column)
//   JW Marriott     — units_available = 0; status = "Sold Out"
//   Ryze            — price excludes 5% VAT (see price_currency)
//   Berkeley Square — handover TBD; price_currency null; no confirmed handover
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from '@/lib/supabase/server'
import type { Project } from '@/lib/supabase'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Derive a reliable status badge from unit count, ignoring inconsistent DB casing. */
export function deriveStatusBadge(p: Project): 'Available' | 'Sold Out' {
  return (p.units_available ?? 0) > 0 ? 'Available' : 'Sold Out'
}

/** URL-safe slug derived from project_name (no slug column in DB). */
export function projectSlug(p: Project): string {
  return p.project_name ? slugify(p.project_name) : String(p.id)
}

/** All projects ordered by id. */
export async function getProjects(): Promise<Project[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase.from('projects').select('*').order('id')
  if (error) throw new Error(`Failed to fetch projects: ${error.message}`)
  return data ?? []
}

/** Single project by numeric id. Returns null if not found. */
export async function getProjectById(id: number): Promise<Project | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // PostgREST "no rows" code
    throw new Error(`Failed to fetch project id=${id}: ${error.message}`)
  }
  return data
}

/**
 * Lookup by URL slug derived from project_name.
 * Fetches all rows and filters client-side (dataset is small; avoids ilike RLS issues).
 */
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const projects = await getProjects()
  return projects.find((p) => projectSlug(p) === slug) ?? null
}

// ─── Analytics ────────────────────────────────────────────────────────────────
// No analytics table exists in the DB.
// TODO: wire to real usage analytics once instrumentation is in place.

export const ANALYTICS = {
  activeClients:    14,
  rechittaUsageMin: 327,
  unitsShown:       52,
  hottestUnit: {
    name:      'Marafid',   // largest project in DB (223 total units)
    views:     908,
    enquiries: 65,
  },
} as const

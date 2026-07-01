import { createClient } from '@supabase/supabase-js'

// Real schema introspected 2026-07-01 from projects table (6 rows).
// starting_price: stored as formatted string (e.g. "1,115,888", "from 730,000")
// service_charge: stored as descriptive string (e.g. "AED 18 per sqft per year") or null
// rental_yield:   null for ALL rows in current dataset
// status:         inconsistent casing ("Available","available","AVAILABLE","Sold Out") — normalise at display
export interface Project {
  id: number
  project_name: string | null
  developer: string | null
  status: string | null
  total_units: number | null
  units_available: number | null
  starting_price: string | null   // formatted string, not a raw number
  price_currency: string | null
  area_value: number | null
  area_unit: string | null        // "sqft" or "sqm" — do NOT convert between them
  payment_plan: string | null
  handover: string | null
  service_charge: string | null   // descriptive string or null
  rental_yield: number | null
  bedrooms: string | null
  location: string | null
  notes: string | null
}

export async function fetchAllProjects(): Promise<Project[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env vars must be set in .env.local')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.from('projects').select('*').order('id')

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`)
  }

  return data ?? []
}

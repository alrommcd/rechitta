import { createClient } from '@supabase/supabase-js'

export interface Project {
  id: number
  project_name: string | null
  developer: string | null
  status: string | null
  total_units: number | null
  units_available: number | null
  starting_price: number | null
  price_currency: string | null
  area_value: number | null
  area_unit: string | null
  payment_plan: string | null
  handover: string | null
  service_charge: number | null
  rental_yield: number | null
  bedrooms: string | null
  location: string | null
  notes: string | null
}

export async function fetchAllProjects(): Promise<Project[]> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.local')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase.from('projects').select('*')

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`)
  }

  return data ?? []
}

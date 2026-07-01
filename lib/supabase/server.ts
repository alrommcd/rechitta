import { createClient } from '@supabase/supabase-js'

// Factory for server-side clients (RSC, Route Handlers, Server Actions).
// Each call returns a fresh client; no shared singleton — safe for concurrent requests.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured in .env.local')
  return createClient(url, key)
}

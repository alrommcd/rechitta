import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton browser client — safe to import in Client Components.
export const supabaseBrowser = createClient(url, key)

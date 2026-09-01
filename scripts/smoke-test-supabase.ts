// Standalone reachability check, run with `npm run supabase:smoke-test`.
// Builds its own client from process.env rather than importing
// src/lib/supabase.ts, because that module reads Vite's import.meta.env,
// which only exists inside the Vite build/dev pipeline, not plain Node.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project values.',
  )
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)
const { data, error } = await supabase.auth.getSession()

if (error) {
  console.error('Supabase reachability check failed:', error.message)
  process.exit(1)
}

console.log('Reached Supabase.', data.session ? 'Session active.' : 'No session (expected when signed out).')

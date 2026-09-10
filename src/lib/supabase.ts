import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const missing = [
  supabaseUrl ? null : 'VITE_SUPABASE_URL',
  supabaseAnonKey ? null : 'VITE_SUPABASE_ANON_KEY',
].filter((name): name is string => name !== null)

// Deliberately *not* thrown at module scope. This module is imported by the
// router's route components, so a throw here happens before React ever
// mounts and the whole app renders as a blank white page with the reason
// only in the devtools console. Exporting the problem instead lets main.tsx
// render a readable configuration screen — the one error in this app a
// developer, not a user, is going to hit, and a blank page is the worst
// possible form of it.
export const supabaseConfigError =
  missing.length > 0
    ? `Missing ${missing.join(' and ')}. Copy .env.example to .env and fill in your project values.`
    : null

// Comfortably above the heaviest RPC here (calculate_results over a full
// event, which is milliseconds at quiz-night scale), and short enough that a
// request which is never coming back becomes an error the screen can show.
// Without a cap, a transport-level failure leaves supabase-js retrying
// indefinitely: the promise neither resolves nor rejects, so every
// `.catch(...)` in the app is dead code and the user sits on a loading
// spinner forever, unable to tell a slow network from a broken one. This is
// per attempt, so a retrying request can take somewhat longer than this to
// surface.
const REQUEST_TIMEOUT_MS = 15_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  // supabase-js passes its own signal for some calls; both have to be able
  // to abort the request, so they're combined rather than overwritten.
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  return fetch(input, { ...init, signal })
}

// The placeholder values keep createClient from throwing on the same
// misconfiguration; main.tsx never mounts the app when supabaseConfigError
// is set, so this client is never actually called with them.
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'missing-anon-key',
  { global: { fetch: fetchWithTimeout } },
)

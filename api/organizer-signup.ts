// Organizer signup (QA19). The only path that creates an account with
// profiles.is_organizer = true.
//
// Why a server route instead of supabase.auth.signUp in the browser: the flag
// has to be set by something the client can't imitate, and nothing inside
// Supabase Auth or the database distinguishes a password signup from a new
// magic-link user (GoTrue gives those a generated password too). So this
// route creates the user with the secret key and then sets the flag itself.
// Anyone can still sign up here — signup is deliberately open; the flag only
// keeps judges' and participants' own accounts from creating events.
//
// The user is created already confirmed, which matches this project's Auth
// settings (email confirmation off). If confirmation is ever turned on, this
// route has to change too, since the admin API skips the confirmation email.

import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const MIN_PASSWORD_LENGTH = 6

// Best-effort brake on scripted signups. The admin API isn't covered by
// Supabase Auth's own per-IP signup rate limit, so this route needs one of its
// own. It is in-memory, so it only holds within one warm function instance —
// a Vercel Firewall rate-limit rule on /api/organizer-signup is the durable
// version. Requests with no forwarded client IP (the local Vite dev adapter)
// aren't limited, since there's nothing to key on.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 10
const attemptsByIp = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string | null): boolean {
  if (!ip) return false
  const now = Date.now()
  const entry = attemptsByIp.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attemptsByIp.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  // Same env access as keepalive.ts — see the note there.
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  const url = env.SUPABASE_URL
  const secretKey = env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    return json({ error: 'Signup is not configured on this server.' }, 500)
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  if (isRateLimited(clientIp)) {
    return json({ error: 'Too many signup attempts. Please try again later.' }, 429)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!name || !email.includes('@')) {
    return json({ error: 'Enter your name and a valid email address.' }, 400)
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(
      { error: `Password should be at least ${MIN_PASSWORD_LENGTH} characters.` },
      400,
    )
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error || !data.user) {
    // GoTrue's 4xx messages ("A user with this email address has already been
    // registered", password policy, ...) are written for end users; a 5xx is
    // not, so it gets a generic message instead.
    const status = error?.status && error.status < 500 ? error.status : 500
    const message =
      status < 500 && error?.message ? error.message : 'Could not create your account. Please try again.'
    return json({ error: message }, status)
  }

  // handle_new_user has already created the profiles row in the same
  // transaction as the auth user. The secret key runs as service_role, which
  // profiles_guard_is_organizer allows.
  const { error: flagError } = await admin
    .from('profiles')
    .update({ is_organizer: true })
    .eq('id', data.user.id)
    .select('id')
    .single()
  if (flagError) {
    // Don't leave a half-made account behind: it couldn't create events, and
    // its email would block signing up again.
    await admin.auth.admin.deleteUser(data.user.id)
    return json({ error: 'Could not create your account. Please try again.' }, 500)
  }

  return json({ ok: true }, 201)
}

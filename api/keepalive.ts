// Vercel Cron endpoint that pings Supabase so the free-tier project is not
// auto-paused for inactivity. It is scheduled from vercel.json and runs on
// PRODUCTION deployments only — Vercel crons do not fire on preview deploys.
//
// A request to the PostgREST root introspects the database, which counts as
// activity and resets Supabase's ~7-day inactivity timer. Once app tables
// exist this can be pointed at a lightweight query instead.

export const config = { runtime: 'edge' }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  // Vercel injects env vars on `process.env` at runtime for both Node and Edge
  // functions. Read it via globalThis so this file type-checks even when Node
  // type definitions aren't in the function's tsconfig (avoids TS2591).
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

  // When CRON_SECRET is set, Vercel sends it as `Authorization: Bearer <secret>`.
  // Enforce it if configured so the endpoint can't be triggered by anyone.
  const cronSecret = env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const url = env.SUPABASE_URL
  const secretKey = env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) {
    const missing = [!url && 'SUPABASE_URL', !secretKey && 'SUPABASE_SECRET_KEY'].filter(Boolean)
    return json({ ok: false, error: `missing env: ${missing.join(', ')}` }, 500)
  }

  try {
    // The PostgREST root endpoint requires a SECRET API key (sb_secret_...),
    // not the publishable/anon key. The key goes in the `apikey` header only —
    // the new-format keys are not JWTs, so they must not go in Authorization.
    // This is a server-only credential (never VITE_-prefixed, never shipped to
    // the browser). Once app tables exist, this can instead query a real table
    // with the publishable key and drop the secret-key dependency.
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: secretKey },
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return json(
        { ok: false, status: res.status, detail: detail.slice(0, 300), ts: new Date().toISOString() },
        502,
      )
    }
    return json({ ok: true, status: res.status, ts: new Date().toISOString() }, 200)
  } catch (err) {
    return json({ ok: false, error: String(err), ts: new Date().toISOString() }, 502)
  }
}

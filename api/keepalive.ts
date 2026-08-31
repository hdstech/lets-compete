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
  // When CRON_SECRET is set, Vercel sends it as `Authorization: Bearer <secret>`.
  // Enforce it if configured so the endpoint can't be triggered by anyone.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return json({ ok: false, error: 'missing SUPABASE_URL or SUPABASE_ANON_KEY' }, 500)
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
    })
    return json(
      { ok: res.ok, status: res.status, ts: new Date().toISOString() },
      res.ok ? 200 : 502,
    )
  } catch (err) {
    return json({ ok: false, error: String(err), ts: new Date().toISOString() }, 502)
  }
}

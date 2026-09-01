# Let's Compete — Event Scoring App

A mobile-first PWA for scoring live competitions. The MVP (**V1**) is a **quiz / Bible Bowl** format: participants answer live, timed questions on their phones; answers are auto pre-marked against an acceptable-answer set and confirmed by a single grader; top-N advance with sudden-death tiebreaks until a champion is declared. A **judged panel** format is planned for V2.

Stack: **Vite + React + TypeScript + Tailwind** (installable PWA) on **Supabase** (Postgres + Auth + Realtime + Storage), hosted on **Vercel**. Domain logic lives in Postgres (RPC / RLS / triggers), so the frontend is a thin, static client and no custom server is required.

## Local development

```bash
npm install
cp .env.example .env   # then fill in your Supabase values
npm run dev            # http://localhost:5173
```

Other scripts: `npm run build` (type-check + production build), `npm run preview`, `npm run lint`.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client (`.env` + Vercel) | Supabase project URL, read by the browser app |
| `VITE_SUPABASE_ANON_KEY` | client (`.env` + Vercel) | Public publishable/anon key; safe to ship — RLS is the security boundary |
| `SUPABASE_URL` | server (Vercel) | Used by the keep-alive function |
| `SUPABASE_SECRET_KEY` | server (Vercel) | **Secret** key (`sb_secret_…`), server-only; the keep-alive pings a Supabase endpoint that requires a secret key |
| `CRON_SECRET` | server (Vercel) | Random string; Vercel passes it to the cron as `Authorization: Bearer <CRON_SECRET>` |

`.env` is git-ignored; set the production copies in **Vercel → Settings → Environment Variables**.

## Database migrations (Supabase)

Schema changes are version-controlled SQL files under [`supabase/migrations/`](supabase/migrations/), applied with the Supabase CLI:

```bash
supabase login                                  # once per machine
supabase link --project-ref <your-project-ref>  # once per clone
supabase migration new <name>                   # scaffold a new migration
supabase db push                                 # apply pending migrations to the linked project
supabase migration list                          # confirm what's applied locally vs remotely
```

`npm run supabase:smoke-test` builds a client from `.env` and calls `supabase.auth.getSession()` to confirm the project is reachable.

## Deployment (Vercel)

Pushing a branch creates a Vercel **preview** deployment; merging to `main` updates production. [`vercel.json`](vercel.json) does two things:

- **SPA routing** — rewrites all non-`/api` paths to `index.html` so React Router deep links resolve (static assets and API functions are served first).
- **Keep-alive cron** — schedules [`api/keepalive.ts`](api/keepalive.ts) daily. It pings Supabase's PostgREST root so the free-tier project isn't auto-paused for inactivity.

Notes:
- Vercel Cron on the **Hobby (free) tier runs at most once per day** and only on **production** deployments (not previews).
- The keep-alive is a pragmatic workaround, not an official Supabase guarantee. If it ever stops resetting the timer, unpause the project manually before test sessions or upgrade to Supabase Pro.

## Project tracking

Architecture and data model live in the plan doc; build work is tracked on the "Event Scoring App — Build Board" Notion kanban (V1 · Quiz MVP vs V2 · Judged).

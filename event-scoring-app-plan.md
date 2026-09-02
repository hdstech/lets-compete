# Event Scoring App — Architecture & Data Model Plan

## Context

Greenfield project. The app scores live competitions and produces a ranked leaderboard — per segment, per round, and an overall champion — computed as a deliberate, persisted, versioned action, never a live tally.

The app supports **two event formats**, chosen once at creation and **immutable thereafter** (`events.format`; switching requires a new event):

- **Quiz / Bible Bowl (`quiz`) — V1, the MVP.** Participants are asked live, timed questions, type an answer, and submit. Answers are auto pre-marked against a predefined acceptable-answer set and confirmed by a **single authoritative grader** after the round. 1 point per correct answer; top-N advance; sudden-death tiebreaks; final round declares the champion.
- **Judged panel (`judged`) — V2, a future version.** A panel of judges scores each participant on numeric criteria per segment; scores sum across judges. This is the original design, preserved in full under "V2 — Judged panel (future)" below and layered onto the same core later.

The two formats differ at the infrastructure level — quiz is **online-required** (Supabase Realtime, live server-authoritative timers, a *participant* data-entry actor); judged is **offline-first** panel scoring — but they **share one results engine**: events, rounds, a participant roster, `RANK()`, top-N advancement, and permanent versioned immutable result sets. `events.format` only switches the **input surface and lifecycle rules**, not the ranking math.

Stakeholders asked for the quiz format first, so this plan is written **V1-first**: everything needed to ship the quiz app stands on its own, and the judged format is a clearly-isolated future increment.

An event can optionally run as **rounds**: progressive elimination stages where the top N by each round's score advance and the rest are eliminated, until a final round declares the winner. Rounds are **opt-in per event** (`events.has_rounds`); a no-rounds event is modeled as a single implicit final round, so the flat format and the rounds format share one code path.

## Format binding

`events.format ∈ {quiz, judged}` is set at insert and enforced immutable by a trigger that rejects any `UPDATE` changing it (same spirit as the "a final score is final" immutability). Every RPC, trigger, and RLS policy can therefore assume one format for an event's lifetime — no half-migrated states, no illegal-transition matrix, no nonsensical conversion of judge `scores` into participant `answers`. V1 builds and exercises `quiz`; `judged` is a reserved enum value wired up in V2.

---

# V1 — Quiz / Bible Bowl (MVP)

## Decisions

**Question delivery (live, synchronized, timed)**
- The admin reveals questions **one at a time**; each reveal opens a countdown answer window. Every active participant answers the same question within the window, then the next is revealed. Delivery is pushed over **Supabase Realtime**.
- **Server-authoritative timing.** The window is enforced in Postgres. On reveal the server stamps the open time and issues a **reveal token**; the client reports *elapsed time against that token*, never its own wall clock — so rolling a device clock back cannot forge an in-window submission.
- **Disconnection tolerance.** A client keeps a local draft and, on reconnect, replays it; the server accepts it only if it arrives within a short **grace window** *and* the token-elapsed ≤ the question window. A no-show or unrecoverably-late answer scores 0.
- **Void.** Before the round is graded, the admin can **void** a bad question (wrong reveal, typo, no valid answer); its answers are discarded and don't count. Voiding is one-way per question but leaves an audit trail.

**Answers & grading (hybrid, single grader, batched)**
- Answers are **typed** (not multiple choice), `text` or `numeric`.
- **Auto pre-mark**: the submitted answer is normalized (trim, case-insensitive, collapsed punctuation) and matched against the question's **acceptable-answer list** (synonyms like "Paul" / "the Apostle Paul"; numeric answers compared by value where listed). This sets a provisional `auto_correct`.
- **Adjudication**: a **single authoritative grader** reviews the whole round's answers at once **after the round closes** (grading is not live and can be done offline), confirming or overriding each `auto_correct` into the final `final_correct`. There is **no summing across judges** — one grade per answer. Correctness is objective enough that a panel/average is unnecessary in V1.
- **Score** = count of `final_correct` = 1 point each. A voided question contributes nothing.

**Participants (self-register, one login each)**
- A participant can be an **individual or a team** (`type` + optional free-text `members`). One **login/device per participant**; a team designates one typist.
- Participants **self-register** against a shared event code and are admitted by **admin approval** (`pending → approved`, or `revoked`).
- **Roster freeze is format-aware**: the participant roster stays open (self-register + approve) through `draft` and after activation, and **freezes at the first question reveal**. Judges/rounds/segments still freeze at activation.
- Event-level `status` (`eligible | disqualified | withdrawn`) excludes a participant from all calculations; a per-question penalty is just a `final_correct = false`.

**Rounds & advancement (shared engine)**
- Top-N per round (`round_participants`), an explicit admin `advance_round`; a tie straddling the cutoff **expands the field** (all tied advance). Final round's rank-1 = champion (co-champions on a rank-1 tie, flagged).
- **Ties are broken by sudden-death tiebreak questions.** Only the tied participants (at an advancement cutoff or rank-1) enter a tiebreak sub-flow: one tiebreak question at a time, same live-timed hybrid-graded mechanics, repeated until the tie breaks. Tiebreak questions come from a **pre-authored reserve pool** defined in `draft`. If the pool is exhausted, fall back to the standard co-advance / co-champion rule.

**Anti-navigation / focus integrity**
- A web app can **detect and deter** leaving the screen, but cannot **prevent** it (the browser is sandboxed — no device lock, no blocking a second device). This layer raises the cost of casual cheating and produces evidence; physical proctoring is the real backstop.
- **Explicit navigation** (close/reload/URL change) → a `beforeunload` warning (native, uncustomizable, weak on mobile).
- **Leaving the screen** (`visibilitychange` → hidden, `pagehide`, `window.blur`) → a **grace-then-submit** countdown with an on-screen warning; return in time resumes editing, timeout **auto-submits the current draft via `navigator.sendBeacon`** (a normal `fetch` is killed on unload) and locks the question. The grace is bounded by `min(grace, time left in the window)`, so it can never buy time past the server-side close, and the server window stays absolute.
- **No fullscreen requirement** — detection rides on visibility/blur only, so behavior is consistent across devices including iOS Safari.
- Every away-event (hidden/blur/return, with timestamps and durations) is written to an **`integrity_events` log** surfaced to the grader at adjudication — the human catches what auto-submit didn't.
- "Leaving the screen submits your answer" is stated in the event rules accepted at self-register (consent, not surprise).

## Stack recommendation

- **Vite + React (TypeScript) + Panda CSS**, installable as a **PWA** (`vite-plugin-pwa`), deployed as a static bundle on a free-tier host (Vercel / Netlify / Cloudflare Pages). Routing via React Router.
  - React specifically because this project is written by an **AI agent** and reviewed by a **solo developer**: agent output is most idiomatic in React, and mainstream JS/JSX keeps the human an effective reviewer.
  - Note: the quiz format is **online-required** during live questioning; the offline-first/service-worker story is a V2 (judged) priority, not a V1 gate. V1 still ships as a PWA for installability and the disconnection draft-replay path.
- **Supabase** (free tier): Postgres + Auth + **Realtime** + Storage.
  - Domain logic pushed **down into Postgres** (RPC functions, RLS, triggers) and exposed over Supabase's HTTP surfaces, so ~90% of core functionality is testable headless (Yaak/HTTP) before any UI exists.
  - **Realtime** is the new V1 dependency: it broadcasts question reveals/countdowns to participant devices.
  - **Auth (GoTrue)** issues admin / participant / grader JWTs; **PostgREST** exposes tables with **RLS per-JWT**; **RPC** holds guarded logic (lifecycle transitions, reveal/void, submit, close-round, adjudicate, `calculate_results`, `advance_round`, `declare_winner`, conclude).
- Client keeps an IndexedDB draft for the current answer (survives a brief disconnect) plus a `sendBeacon` submit-on-exit path.

## MVP hosting & deployment

Because all domain logic lives in Postgres and the Supabase anon key is public + RLS-guarded, the app needs **no server runtime** — only a static host for the SPA bundle plus managed Supabase. Both have real free tiers, so a test deployment is $0 to start.

- **Backend — Supabase (managed).** Free tier (500 MB DB, 1 GB storage, Realtime included) is enough for a small test group. Two caveats matter for a live quiz: free projects **auto-pause after ~7 days of inactivity**, and free-tier Realtime has a **concurrent-connection cap** (every participant in a live round is connected at once). Pick a **region near the testers** — live timers are latency-sensitive. Move to **Pro (~$25/mo)** once pausing or limits get in the way.
- **Frontend — static host (Vercel).** The Vite SPA deploys as a static bundle to **Vercel** (chosen; Cloudflare Pages / Netlify are equivalent). All give **free HTTPS on a subdomain**, which is required for PWA install, Realtime WebSockets, and `sendBeacon`. Testers just open the URL on their phones (installable PWA, no app store); Vercel preview URLs per push make sharing test builds easy.
- **Keep-alive (avoid auto-pause).** A **Vercel Cron Job** pings Supabase on a schedule so the free project isn't paused between test sessions (implementation in the Track 0 deploy ticket). A **daily** ping suffices — the Vercel Hobby tier caps crons at once/day, which is fine since pausing is a 7-day timer. This is a pragmatic workaround, not an official Supabase guarantee; if it ever stops resetting the timer, fall back to a manual unpause before sessions or upgrade to Pro.
- **Config.** Only public config is needed client-side (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); RLS is the security boundary. The keep-alive function additionally verifies a `CRON_SECRET` so the endpoint can't be abused.

## Manual prerequisites (human-only, before implementation)

The agent handles all code, migrations, RLS, `vercel.json`, and the keep-alive function. These steps require a human — creating accounts, holding secrets, and choosing a few settings.

**Accounts to create** (blocking):
- **GitHub** — an empty repo (Vercel deploys + preview URLs need a git remote; the working directory isn't a repo yet).
- **Supabase** — a project: pick a **region near the testers**, save the **DB password**, and note the **Project URL**, **anon key**, and **service role key**.
- **Vercel** — connected to the GitHub account/repo.
- *(Optional)* a **custom domain** instead of the free `*.vercel.app` subdomain.

**Secrets & config** (human sets these; never in code):
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` — safe to share; shipped in the client bundle (RLS is the boundary).
- **Service role key** + **DB password** — kept private. If the keep-alive reads an `anon`-readable table, the cron can use only the anon key and skip the service key entirely.
- **`CRON_SECRET`** — a random string for the keep-alive endpoint.
- Locations: a git-ignored local `.env` for dev; **Vercel → Environment Variables** for prod.

**Decisions to lock before build:**
- **Auth method** — magic-link (email) recommended for phones at a venue; email+password or Google OAuth are alternatives. Drives Supabase Auth config.
- **Disable email confirmation** for testers (reduce friction).
- **Allowed redirect URLs** in Supabase Auth — add `http://localhost:5173` and the `*.vercel.app` URL.
- Assign the test roles: **admin**, **grader**, **participants**.

**Local tooling:** Node.js LTS + npm, Git, and the **Supabase CLI** (`supabase login`, for migrations). Vercel CLI optional.

**Critical path to unblock implementation:** GitHub repo → Supabase project (region + keys saved) → Vercel linked → auth method chosen → hand off `SUPABASE_URL` + anon key. Everything else (service key, `CRON_SECRET`, redirect URLs, tester recruitment) can proceed in parallel during the backend build.

## Data model — shared core

```
profiles                                 -- mirrors auth.users
  id (pk, = auth.users.id), name, email, created_at

events
  id (pk), name, event_date
  organizer_id (fk -> profiles.id)
  format                                  -- quiz | judged  (immutable after insert)
  status                                  -- draft | active | concluded
  has_rounds (boolean, default false)
  winner_participant_id (fk -> participants, nullable)
  concluded_at (nullable)
  join_code (unique)                      -- participant self-register code (quiz); judge invite (judged)
  created_at

rounds                                   -- elimination stages (>=1; no-rounds event has one implicit round)
  id (pk), event_id (fk -> events)
  name, sequence (int)
  advancement_type                        -- 'top_n' (MVP); reserves 'threshold_score','all'
  advancement_n (int, nullable)           -- NULL on the final round
  is_final_round (boolean)
  status                                  -- pending | scoring_open | scoring_closed | advanced
  scoring_opened_at, scoring_closed_at, advanced_at (nullable)
  created_at
  unique(event_id, sequence)
  check (is_final_round = (advancement_n IS NULL))

segments
  id (pk), round_id (fk -> rounds)
  name, sequence, created_at

participants
  id (pk), event_id (fk -> events)
  name, type                              -- individual | team
  members (text, nullable)                -- teams only
  status                                  -- eligible | disqualified | withdrawn
  user_id (fk -> profiles, nullable)      -- the participant's login (quiz self-register)
  admission_status                        -- pending | approved | revoked  (quiz)
  created_at

round_participants                        -- who is active in each round + advancement outcome
  id (pk)
  round_id (fk -> rounds), participant_id (fk -> participants)
  status                                  -- active | advanced | eliminated
  advanced_by_calculation_id (fk -> result_calculations, nullable)
  created_at, updated_at
  unique(round_id, participant_id)

-- Results: permanent, versioned, immutable ------------------------------------
result_calculations                       -- one row per "Calculate Results" action
  id (pk), event_id (fk -> events)
  round_id (fk -> rounds, nullable)       -- scope dimension
  segment_id (fk -> segments, nullable)   -- scope dimension
  calculated_at, calculated_by (fk -> profiles)
  reason (text, nullable)
  is_final (boolean)                      -- exactly one true per (event, round, segment) scope

result_calculation_exclusions
  id (pk), calculation_id (fk), excluded_type (judge|participant), excluded_id, note

result_calculation_entries
  id (pk), calculation_id (fk), participant_id (fk), total_score, rank
```

`result_calculations` scope (`round_id`/`segment_id` nullability): both set = per-segment leaderboard; round set / segment null = **per-round** leaderboard (the advancement/champion input); both null = event-overall (MVP = final round result).

## Data model — quiz format

```
questions                                 -- the scored unit in quiz mode (replaces scoring_criteria)
  id (pk), segment_id (fk -> segments)
  prompt (text)
  answer_type                             -- text | numeric
  window_seconds (int)                    -- answer window length
  sequence (int)
  is_tiebreak (boolean, default false)    -- true = drawn from the reserve pool for sudden-death
  status                                  -- pending | revealed | window_open | window_closed | voided
  reveal_token (text, nullable)           -- issued at reveal; anchors server-authoritative elapsed time
  revealed_at, window_closed_at (nullable)
  voided_at, voided_by (nullable)
  created_at

question_acceptable_answers               -- the acceptable set powering auto pre-mark
  id (pk), question_id (fk -> questions)
  value (text)
  is_numeric (boolean)                    -- compare by numeric value rather than normalized string
  created_at

answers                                   -- core fact table: participant × question
  id (pk)
  participant_id (fk -> participants)
  question_id (fk -> questions)
  round_id (fk -> rounds)                 -- denormalized for scope/index convenience
  segment_id (fk -> segments)             -- denormalized for query/index convenience
  submitted_text (text)
  submitted_at (timestamptz)
  is_saved_draft (boolean)                -- true = arrived via sendBeacon / reconnect replay
  client_elapsed_ms (int, nullable)       -- reported elapsed against reveal_token
  auto_correct (boolean, nullable)        -- provisional, from the matcher
  final_correct (boolean, nullable)       -- grader-adjudicated; sums to points
  graded_by (fk -> profiles, nullable), graded_at (nullable)
  created_at, updated_at
  unique(participant_id, question_id)

integrity_events                          -- focus/away audit for the grader
  id (pk)
  participant_id (fk -> participants)
  question_id (fk -> questions, nullable)
  kind                                    -- hidden | blur | return | beforeunload | auto_submit
  occurred_at (timestamptz)
  duration_ms (int, nullable)
  created_at
```

Tiebreak reserve pool = `questions` rows with `is_tiebreak = true`, authored in `draft`, drawn into a sudden-death sub-segment as needed. `event → round → segment → question` replaces `… → scoring_criteria` for quiz.

## Quiz lifecycle

- **Draft**: admin creates the event (`format = quiz`), builds rounds/segments, authors questions + acceptable answers + `window_seconds`, and the tiebreak reserve pool. Participants self-register against `join_code`; admin approves them.
- **Activate** (`draft → active`): freezes rounds/segments/questions; opens round 1. Participant roster stays open until first reveal.
- **Per question** (round `scoring_open`): admin **reveals** → server issues `reveal_token`, broadcasts via Realtime, opens the window → participants submit (or draft) → **window closes server-side** (no-shows = 0). Admin may **void** before grading. Repeat for all questions.
- **Round close**: gated on **all of the round's questions being `window_closed` or `voided`** (the quiz analogue of the judged completeness gate). One-way.
- **Adjudicate**: the single grader reviews the round's answers (auto pre-marked), sets `final_correct`, aided by the `integrity_events` log.
- **Calculate** (`calculate_results`, quiz branch): sum `final_correct` per participant across the round's segments; `RANK()`; write a versioned immutable result set.
- **Advance** (`advance_round`): top-N advance; ties at the cutoff trigger the **sudden-death tiebreak** sub-flow; the rest are eliminated; the next round opens. On the final round → `declare_winner` → `concluded`.

## Immutability enforcement (quiz)

An `answers` row locks when **either** its question's window has closed **or** the round has been graded/calculated. Enforced in three layers:
1. **App** — the client only allows editing while the question is `window_open` and within grace.
2. **DB trigger** — `BEFORE INSERT OR UPDATE` on `answers` rejects a write whose question is past `window_open` (except the grader's `final_correct` write, and except a within-grace replay that satisfies token-elapsed ≤ window). Unbypassable even by a direct API call.
3. **RLS** — a participant may only write their own `answers` row while its window is open; the grader may only write `final_correct`; the admin is read-only on answers. Result tables are insert-only except the atomic `is_final` flip on a new calculation.

## Ranking & advancement computation (shared)

Deliberate admin action, never live. `calculate_results` for a scope: select the scope's answers, exclude non-`eligible` participants and (for round/segment scopes) only the round's `active` participants; per-participant total = **sum of `final_correct`** (quiz) / sum of criterion values across judges (judged, V2); `RANK() OVER (ORDER BY total DESC)`; write a new `result_calculations` header + exclusion snapshot + frozen `result_calculation_entries`, flipping any prior `is_final` for that scope to false; no-op on unchanged input. `advance_round` reads the round's `is_final` per-round entries, advances rank ≤ N (tie expands / triggers tiebreak), writes `round_participants`, seeds + opens the next round, or declares the winner on the final round.

---

# V2 — Judged panel (future)

The original multi-judge design, preserved intact and layered onto the same core when V1 ships. `events.format = 'judged'` selects this path. **Not built in the MVP.**

**Model.** A panel of admitted judges scores every active participant on numeric `scoring_criteria` (bounded by `min_value`/`max_value`) for every segment of the current round. Aggregation is a straight **sum across all counted judges**. Judges never see each other's scores or any running tally.

**Deferred tables** (added in the V2 migration; documented here):
```
scoring_criteria   -- id, segment_id (fk), name, min_value, max_value, sequence
scores             -- id, event_judge_id (fk), participant_id, round_id, segment_id,
                   --   criteria_id, value (numeric), created_at, updated_at
                   --   unique(event_judge_id, participant_id, criteria_id)
score_feedback     -- id, event_judge_id, participant_id, segment_id,
                   --   feedback_text, photo_url, note, unique(...)
event_judges       -- id, event_id, user_id, status (admitted|revoked), joined_at
round_final_submissions  -- id, round_id, event_judge_id, submitted_at, unique(round_id, event_judge_id)
participant_segments     -- (participant_id, segment_id) membership; UI defaults every active participant into all segments
```

**Judged-specific behavior.**
- **Blind-judge RLS**: a judge writes only their own rows, only while unlocked; admins are read-only on scores.
- **Roster freeze**: judged keeps the **hard `draft → active` freeze** for participants (no self-register).
- **Completeness gate**: a round can't close until every active (non-revoked) judge has a score for every criterion of every active participant across the round's segments; **revoke** is the escape valve for a judge who can't finish.
- **Dual-lock immutability**: a per-judge voluntary round final-submit, plus the admin close-scoring, both lock scores (DB trigger enforced).
- **Offline-first judging**: IndexedDB draft (incl. an unsent photo blob) + sync-on-reconnect; the completeness gate counts only synced scores.
- **DQ semantics**: event-level `status` excludes entirely; a segment/criterion penalty sets the affected score to **0** with a note (participant stays eligible).
- **Photo/feedback**: a single photo + free-text feedback per judge/participant/segment, captured but never entering the ranking math.
- `calculate_results` gains a **judged branch** (sum `scores.value` across counted judges); `RANK()`, advancement, and versioned results are the same shared engine.

---

## Build phases

Sequenced **API-first**: the backend is built and verified via HTTP/Yaak before the UI, so the highest-risk logic — server-authoritative timing, answer immutability, versioned ranking, advancement/tiebreak — is proven before any screen exists. The Yaak workspace becomes a living regression suite.

### V1 — Quiz MVP

**Foundations**
- **T0** Project brief & conventions. **T1** Scaffold Vite + React + TS + Panda CSS (PWA). **T2** Provision Supabase (+ Realtime) + env + migrations.

**Backend / API (Track A, verified headless)**
- **QA0** `events.format` enum + immutability trigger.
- **QA1** Schema migration — shared + quiz tables (`events`+format, `rounds`, `segments`, `questions`, `question_acceptable_answers`, `participants`+identity, `answers`, `integrity_events`, `round_participants`, `result_*`).
- **T4** Auth + `profiles` mirror; capture admin / participant / grader JWTs.
- **QA2** RLS — participant writes own unlocked `answers`; grader writes `final_correct`; admin read-only.
- **T6** Event lifecycle RPC + guards (format-aware; quiz activation opens round 1, roster freezes at first reveal).
- **T8a** Round CRUD + advancement config.
- **QA3** Participant self-register + admin-approve + identity RPC (`join_code`).
- **QA4** Question authoring CRUD (questions + acceptable answers + `window_seconds` + tiebreak reserve), draft-only.
- **QA5** Realtime reveal RPC (issues `reveal_token`, broadcasts) + server-authoritative window close.
- **QA6** Answer submission API (submit + draft/`sendBeacon`, token-elapsed + grace acceptance, auto-0 on close).
- **QA7** Auto pre-mark matcher (normalize + acceptable list + numeric equivalence).
- **QA8** Void-question RPC.
- **QA9** Round-close (all-windows-closed) gate.
- **QA10** Batched single-grader adjudication RPC (`final_correct`, override auto).
- **QA11** Answer immutability trigger.
- **T16** `calculate_results()` — quiz branch (sum `final_correct`), scope filtering, `RANK()`, exclusion snapshot, frozen entries, `is_final` flip, no-op on unchanged.
- **QA12 / T16a** `advance_round` + **tiebreak sudden-death** (reserve pool, one at a time) + `declare_winner`.
- **T17** Conclude RPC (terminal). **T18** Yaak regression suite.

**Frontend / UI (Track B)**
- **T19** Auth screens + session protection.
- **T20** Admin — event CRUD (+ **format selection**) + lifecycle controls.
- **T21a** Admin — round builder + advancement config.
- **QB1** Admin — question authoring UI (+ timer + tiebreak reserve pool).
- **QB2** Admin — **live quiz console** (reveal/void/advance, countdown, who's-answered, integrity flags).
- **QB3** Participant — join/self-register + waiting-room dashboard.
- **QB4** Participant — **live answering screen** (mobile: receive question, timer, submit, draft).
- **QB5** **Focus-integrity layer** (`beforeunload` warning + grace-then-submit + `sendBeacon` + integrity log).
- **QB6** Grader — **batched adjudication screen** (auto pre-marked, override, integrity view).
- **T28** Results — segment / per-round / overall leaderboards.
- **T29** Results — recalculation + calculation history.
- **QB7** Admin — advancement review/commit + **tiebreak trigger** + winner declaration.

**Polish & verification (Track C)**
- **T31** Mobile responsiveness (participant answering surface priority). **T32** Empty/error/loading states. **T33** Full E2E walkthrough (author → reveal/timer → answer + focus integrity → close → adjudicate → calculate → advance/tiebreak → champion → conclude).

### V2 — Judged panel (future)

Layered on the shipped V1 core: **judge-tables migration** (`scores`, `score_feedback`, `event_judges`, `round_final_submissions`, `scoring_criteria`, `participant_segments`); **T5** blind-judge RLS; **T7** judged roster-freeze at `draft→active`; **T8** criteria CRUD (min/max); **T11** scoring write API; **T12** score_feedback API; **T13** storage bucket + photo; **T14** per-round completeness gate + close-round; **T15** multi-judge dual-lock trigger; `calculate_results` judged branch; **T21** admin segment/criteria/participant mgmt; **T23** judge join + dashboard; **T24** judge scoring screen; **T25/T26** offline caching + sync; **T27** judge final-submit + locked UI; **T30** DQ/segment-zeroing UI.

## Verification

- **Quiz E2E** (V1): create a `quiz` event; author questions with acceptable answers + windows + a tiebreak reserve; self-register two participants (second incognito) and approve; activate. Reveal a question → confirm the countdown and Realtime push; submit under both participants; let one window expire with no answer → confirm it scores 0. Disconnect mid-window and reconnect within grace → confirm the draft lands iff token-elapsed ≤ window. Switch tabs/apps → confirm the grace warning, then `sendBeacon` auto-submit + integrity-log entry. Void a question → confirm it drops from scoring. Close the round (gated on all windows closed). Adjudicate: confirm auto pre-marks, override one, confirm `final_correct` wins. Calculate → verify point sums and `RANK()`; manufacture a tie at the cutoff → confirm the **sudden-death tiebreak** runs one question at a time until separated. Advance → confirm top-N + eliminated; final round → `declare_winner` (rank-1 tie → co-champions flagged); conclude.
- **Integrity**: verify a rolled-back client clock cannot forge an in-window answer (token-elapsed governs), and that `beforeunload` fires on explicit navigation.
- **No-rounds regression**: a `has_rounds = false` quiz event collapses to one implicit round.
- Use the browser tool at a **mobile viewport** to sanity-check the participant answering screen and the focus-integrity behavior — the real usage context.
- **V2** verification (judged: panel scoring, blind RLS, offline sync, completeness gate, DQ semantics) is carried in the V2 increment, unchanged from the original design.

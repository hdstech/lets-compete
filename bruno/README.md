# Backend Regression Suite (T18) — Bruno Edition

This is a **parallel, alternative** translation of the same regression suite
shipped in [`../yaak/`](../yaak/) (Postman Collection v2.1, imported into
[Yaak](https://yaak.app)), built for [Bruno](https://www.usebruno.com/) — a
git-native API client that stores each request as a plain-text `.bru` file
instead of one large JSON blob. It is **not a replacement**: `../yaak/` stays
the primary deliverable referenced by ticket **T18** in
[`../event-scoring-app-plan.md`](../event-scoring-app-plan.md). This folder
exists purely so the two tools can be compared side by side.

Every folder, request, header, body, and test/capture script here was
**translated 1:1** from `../yaak/event-app.postman_collection.json` and
`../yaak/event-app.postman_environment.json` — same 17 folders (`QA0` →
`T17`), same 60 requests, same run order, same fixture-authoring decisions.
Nothing was redesigned; where the two collections differ it is only because
Postman and Bruno express the same request differently (JSON blob vs.
`.bru` text block), never because the underlying request changed. Kept in
parity by construction — if the Postman/Yaak collection is ever updated,
this folder should be re-translated the same way.

## Files

| Path | What it is |
|---|---|
| `bruno.json` | Collection manifest (name/type/ignore) that marks this folder as a Bruno collection. |
| `<folder>/folder.bru` | One per ticket folder (17 total) — `meta { name, seq }` plus a `docs { }` block carrying the same explanatory text as that folder's `description` in the Postman collection. |
| `<folder>/<Request Name>.bru` | One per request (60 total) — `meta`, the HTTP method block (`post`/`patch`), `headers`, `body:json`, an optional `script:post-response` (translated from the Postman test/capture script), and a `docs` block (translated from the Postman request description). |
| `environments/local.bru` | The 38 variables the collection references (`base_url`, JWTs, fixture ids, ...). Every value ships **empty** — no real secrets are committed here. `anon_key` and the three `*_jwt`/`*_password` pairs (7 vars total) are declared under `vars:secret`, so Bruno keeps their real values in its own local secret store instead of writing them into this file. |
| `README.md` | This file. |

## Opening in Bruno

1. Install [Bruno](https://www.usebruno.com/) (desktop app or CLI).
2. **Open Collection** → pick this `bruno/` folder (the one containing
   `bruno.json`) — Bruno reads the folder tree directly, no import step
   needed.
3. Confirm the 17 folders show up in Bruno's sidebar, ordered `Auth` →
   `T17` (each folder's `seq` in its `folder.bru` controls this order; each
   request's `seq` controls its order within its folder).
4. In the environment selector (top-right), pick **local** — the
   environment shipped in `environments/local.bru`.

## Filling in environment values

Never hardcode real values into any `.bru` file. Instead, open the **local**
environment in Bruno (the environment-selector dropdown → the pencil/edit
icon, or the collection's Environments settings) and fill in:

- `base_url` — from the repo's `.env`, this is `VITE_SUPABASE_URL`
  (e.g. `https://YOUR-PROJECT-REF.supabase.co`).
- `anon_key` — from `.env`, this is `VITE_SUPABASE_ANON_KEY` (the
  publishable/anon key — safe to use here since RLS is the real security
  boundary, but still declared `vars:secret` below out of caution).
- `admin_email` / `admin_password`, `participant_email` / `participant_password`,
  `grader_email` / `grader_password` — pick any test credentials for three
  throwaway Supabase Auth users. These aren't org secrets, just fixture
  data for the suite's three seeded roles (organizer/admin, participant,
  grader — see T4's profiles-mirror trigger and QA2's per-event
  `organizer_id` / `grader_id` / participant model).
- `admin_jwt` / `participant_jwt` / `grader_jwt` — normally populated
  automatically (see below), but declared here as inputs too since they're
  `vars:secret`.
- `anon_key`, the three `*_password` fields, and the three `*_jwt` fields
  are all declared under `vars:secret` in `environments/local.bru`, so
  Bruno masks them in the UI, excludes them from any collection export,
  and — this is the important part — **keeps their real values out of
  this checked-in file entirely**, storing them instead in Bruno's own
  local, unsynced secret store. Everything else (`*_user_id`, `event_id`,
  `join_code`, every other `*_id`, `*_reveal_token`,
  `*_calculation_id`, ...) is a plain, non-secret `var` populated
  automatically by each request's own `script:post-response` block as you
  run requests — leave these blank.

  **Why this matters**: an earlier version of this file kept `anon_key`
  and the JWTs as plain `vars` instead of `vars:secret`. Running the
  collection then wrote real captured values — a live project URL, an
  anon key, and three real user JWTs — directly into this tracked file.
  Nothing was committed, but it's worth knowing the failure mode: **after
  any run, `git diff environments/local.bru` before staging anything** —
  a plain `vars` block that comes back non-empty means a real secret just
  landed in a git-tracked file.

One manual prerequisite outside this collection: in the Supabase dashboard,
enable **Email** auth and **disable "confirm email"**, so the Auth folder's
Sign Up requests return a session (`access_token`) directly instead of
requiring an email-confirmation click (T4's migration comment flags this as
a manual step, not something a migration can do).

## Run order

Folders are ordered to match the plan's Track A ticket sequence (`QA0` →
`T17`) and are designed to be run **top-to-bottom in one pass** via Bruno's
collection runner, or by hand:

1. **Auth** — sign up (or log in, on a re-run) the three seeded users;
   captures `admin_jwt` / `participant_jwt` / `grader_jwt` and their user
   ids. Everything downstream depends on this running first.
2. **QA0** — empty folder, `docs` notes only (pure schema/trigger ticket,
   no endpoint of its own — no `.bru` request files inside).
3. **QA2** — three deliberately-403 RLS negative tests, one per role.
   Order-independent (uses a nil UUID), included here mainly to keep the
   folder order matching the ticket order.
4. **T6** — creates the event, both rounds, both segments, and all four
   questions (+ acceptable answers), then calls `activate_event`. See the
   note below on why fixture authoring is consolidated into this folder.
5. **T8a** — three negative tests proving the round/segment config freeze
   now that the event is active.
6. **QA3** — participant self-register, organizer-approve, identity lookup.
7. **QA4** — three negative tests proving the question/acceptable-answer
   authoring freeze now that the event is active.
8. **QA5** — reveal Question 1, a too-early close attempt (expected to
   fail), then the real close. **Timing-sensitive**: Question 1's
   `window_seconds` is 20 — wait at least 20s between "Reveal Question 1"
   and "Close Question Window (Question 1)".
9. **QA6** — submits Question 1's answer. Run promptly after QA5's close
   (within the 10s grace period) — this deliberately exercises the
   grace-period/reconnect-replay acceptance path, not a live in-window
   submit.
10. **QA7** — auto pre-marks Question 1's answers. Requires ~10s grace
    since window close; wait a few seconds if it 400s on the first try.
11. **QA8** — reveals and voids a dedicated throwaway question.
12. **QA9** — closes round 1.
13. **QA10** — grader adjudicates round 1's answers.
14. **T16** — calculates round 1's results.
15. **T16a** — advances round 1, then **replays** the reveal → submit →
    close → auto-mark → adjudicate → close-round → calculate-results
    pipeline against the final round's question (declare_winner requires
    the final round to already be fully played and calculated), then
    declares the winner. Same 20s / 10s timing notes apply.
16. **QA12** — the sudden-death tiebreak sub-flow. **Expected to fail** at
    "Start Tiebreak (Round 1)" in this suite's default single-participant
    fixture (a tie needs ≥2 participants tied at the cutoff rank). The
    requests are still fully and correctly shaped; see the folder's
    `folder.bru` `docs` block for how to seed a second participant and
    actually trigger a tie.
17. **T17** — concludes the event, then proves re-concluding is rejected.

### Why some folders don't do what their ticket name implies

Several DB triggers freeze rounds/segments/questions once an event leaves
`draft` (T8a, QA4). Because `activate_event` (T6) is positioned early in
the ticket order but the round/segment/question CRUD tickets (T8a, QA4) are
positioned *after* it, a strictly ticket-ordered "CRUD lives in its own
ticket's folder" layout would be unrunnable end-to-end — by the time T8a's
or QA4's folder ran, the freeze would already reject every insert.

The fix: **T6's folder carries all draft-phase fixture authoring** (event,
rounds, segments, questions, acceptable answers) as explicit prerequisite
requests before `activate_event`, and the T8a / QA4 folders that follow
prove the *freeze itself* as negative tests instead of duplicating
creation. Each affected folder's own `folder.bru` `docs` block (and, for
requests moved out of their "natural" ticket folder, that request's own
`docs` block) explains this in place. Two of T8a's/QA4's constraint checks
(`advancement_n > 0`, `is_final_round` uniqueness, `window_seconds > 0`)
only make sense pre-activation, so those specific negative tests are
embedded in the T6 folder instead, clearly labeled `[T8a]` / `[QA4]` in
their request names.

QA11 (the answers-immutability trigger) has no folder of its own — it's a
pure backstop trigger with no endpoint, indirectly exercised by QA6/QA7's
own timing-gated requests. QA1 and T4 are schema/trigger-only tickets with
nothing to call and are omitted entirely, matching QA0's "notes only, no
request" treatment taken one step further.

## Notes

- Every RPC call is `POST {{base_url}}/rest/v1/rpc/<function_name>` with a
  `body:json` block whose keys are the exact SQL parameter names, `p_`
  prefix included (e.g. `{"p_event_id": "{{event_id}}"}`) — PostgREST does
  not strip it.
- Every request carries `apikey: {{anon_key}}` and, except the two Auth
  "anon" calls, `Authorization: Bearer {{<role>_jwt}}` for whichever role
  (admin/participant/grader) the RLS policy or RPC's own authorization
  check requires.
- Table writes via PostgREST (`/rest/v1/<table>`) that need the generated
  id back use `Prefer: return=representation`.
- Test/capture logic lives in each request's `script:post-response` block,
  using Bruno's own scripting API (`res.status`, `res.body`,
  `bru.setEnvVar(...)`, `test(...)`/`expect(...)`) — the direct equivalent
  of the source Postman collection's `pm.response.code`,
  `pm.response.json()`, `pm.environment.set(...)`, and `pm.test(...)`.
  Conditional capture logic (only set on success, array-vs-object response
  shapes) was preserved exactly from the Postman source, not simplified.
- If you re-run this suite against the same Supabase project without
  resetting data, use the **Log In** requests in Auth instead of **Sign
  Up** (which will 422/400 on an already-registered email), and expect the
  T6 folder's fixture creation to succeed fresh each time (it always
  creates a new event).

## How this was produced

This collection was generated by running the official
[`@usebruno/converters`](https://www.npmjs.com/package/@usebruno/converters)
(`postmanToBruno` / `postmanToBrunoEnvironment`) and
[`@usebruno/lang`](https://www.npmjs.com/package/@usebruno/lang)
(`jsonToBruV2`, the same serializer Bruno's own app uses to write `.bru`
files) against the source Postman collection/environment, then hand-fixing
two things the converter got technically-valid-but-not-idiomatic:
normalizing `res.getStatus()`/`res.getBody()` calls to the `res.status` /
`res.body` property form, and sanitizing the handful of request/folder
names containing `/` or `:` (illegal in Windows/macOS filenames) into safe
file/directory names while leaving the `meta { name: ... }` display name
inside each file untouched. Every generated `.bru` file was then
round-tripped back through the parser (`bruToJsonV2`) and diffed
field-by-field (method, url, headers, body JSON, docs) against both the
converter's intermediate JSON and the original Postman JSON directly — all
60 requests and 17 folders matched with zero discrepancies.

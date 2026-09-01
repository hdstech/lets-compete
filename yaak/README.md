# Backend Regression Suite (T18)

This is the living regression suite referenced by ticket **T18** in
[`event-scoring-app-plan.md`](../event-scoring-app-plan.md), covering every
backend RPC and table built for the event-scoring app from **QA0 through
T17**. It replaces the originally-planned Insomnia collection: tooling has
switched to [Yaak](https://yaak.app), a local-first API client whose own
sync format (`yaak.${MODEL_ID}.yaml`) is undocumented and app-generated, so
it isn't safe to hand-author. Instead, this folder ships a standard
**Postman Collection v2.1** file, which Yaak imports natively and preserves
as folders/requests/variables.

## Files

| File | What it is |
|---|---|
| `event-app.postman_collection.json` | The regression suite itself — 17 folders (one per ticket, `QA0` → `T17`), 60 requests. |
| `event-app.postman_environment.json` | The variables the collection references (`{{base_url}}`, JWTs, fixture ids, ...). Every value ships **empty** — no real secrets are committed here. |
| `README.md` | This file. |

## Importing into Yaak

1. Open Yaak and pick your workspace (or create one for this project).
2. Open the workspace/settings menu → **Import**.
3. Choose **Postman** as the source, and select `event-app.postman_collection.json`.
4. Repeat Import for `event-app.postman_environment.json` (Yaak also reads
   Postman environment exports) — or, if Yaak's importer only asks for one
   file, import the collection first, then import the environment file
   separately from the same Import dialog.
5. Confirm the 17 folders and the environment (with all its empty variables)
   now show up in Yaak's sidebar.

## Filling in environment values

Never hardcode real values into either JSON file. Instead, open the
imported environment in Yaak and fill in:

- `base_url` — from the repo's `.env`, this is `VITE_SUPABASE_URL`
  (e.g. `https://YOUR-PROJECT-REF.supabase.co`).
- `anon_key` — from `.env`, this is `VITE_SUPABASE_ANON_KEY` (the
  publishable/anon key — safe to use here since RLS is the real security
  boundary; still don't commit it into this collection).
- `admin_email` / `admin_password`, `participant_email` / `participant_password`,
  `grader_email` / `grader_password` — pick any test credentials for three
  throwaway Supabase Auth users. These aren't org secrets, just fixture
  data for the suite's three seeded roles (organizer/admin, participant,
  grader — see T4's profiles-mirror trigger and QA2's per-event
  `organizer_id` / `grader_id` / participant model).
- Everything else (`*_jwt`, `*_user_id`, `event_id`, `join_code`, every
  `*_id`, `*_reveal_token`, `*_calculation_id`, `tiebreak_id`, ...) is
  populated automatically by the collection's own test scripts as you run
  requests — leave these blank.

One manual prerequisite outside this collection: in the Supabase dashboard,
enable **Email** auth and **disable "confirm email"**, so the Auth folder's
Sign Up requests return a session (`access_token`) directly instead of
requiring an email-confirmation click (T4's migration comment flags this as
a manual step, not something a migration can do).

## Run order

Folders are ordered to match the plan's Track A ticket sequence (`QA0` →
`T17`) and are designed to be run **top-to-bottom in one pass** via Yaak's
(or Postman's) collection runner, or by hand:

1. **Auth** — sign up (or log in, on a re-run) the three seeded users;
   captures `admin_jwt` / `participant_jwt` / `grader_jwt` and their user
   ids. Everything downstream depends on this running first.
2. **QA0** — empty folder, notes only (pure schema/trigger ticket, no
   endpoint of its own).
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
    "Start Tiebreak" in this suite's default single-participant fixture (a
    tie needs ≥2 participants tied at the cutoff rank). The requests are
    still fully and correctly shaped; see the folder's own description for
    how to seed a second participant and actually trigger a tie.
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
steps before `activate_event`, and the T8a / QA4 folders that follow prove
the *freeze itself* as negative tests instead of duplicating creation.
Each affected folder's own `description` field explains this in place.
Two of T8a's/QA4's constraint checks (`advancement_n > 0`, `is_final_round`
uniqueness, `window_seconds > 0`) only make sense pre-activation, so those
specific negative tests are embedded in the T6 folder instead, clearly
labeled `[T8a]` / `[QA4]`.

QA11 (the answers-immutability trigger) has no folder of its own — it's a
pure backstop trigger with no endpoint, indirectly exercised by QA6/QA7's
own timing-gated requests. QA1 and T4 are schema/trigger-only tickets with
nothing to call and are omitted entirely, matching QA0's "note only, no
request" treatment taken one step further.

## Notes

- Every RPC call is `POST {{base_url}}/rest/v1/rpc/<function_name>` with a
  JSON body whose keys are the exact SQL parameter names, `p_` prefix
  included (e.g. `{"p_event_id": "{{event_id}}"}`) — PostgREST does not
  strip it.
- Every request carries `apikey: {{anon_key}}` and, except the two Auth
  "anon" calls, `Authorization: Bearer {{<role>_jwt}}` for whichever role
  (admin/participant/grader) the RLS policy or RPC's own authorization
  check requires.
- Table writes via PostgREST (`/rest/v1/<table>`) that need the generated
  id back use `Prefer: return=representation`.
- If you re-run this suite against the same Supabase project without
  resetting data, use the **Log In** requests in Auth instead of **Sign
  Up** (which will 422/400 on an already-registered email), and expect the
  T6 folder's fixture creation to succeed fresh each time (it always
  creates a new event).

---
name: implement-ticket
description: End-to-end workflow for implementing one ticket from the "Event Scoring App — Build Board" Notion kanban in this repo (event_app) — looking up the ticket and its dependencies, branching correctly, exploring existing conventions, implementing, verifying, opening a PR, and updating the board. Use this whenever the user asks to implement, build, work on, start, or pick up a ticket by its ID (e.g. "implement T21a", "work on QB1", "let's do the next ticket", "/implement-ticket T22"), or asks what's next on the board and then wants to proceed with it. Also use it if the user describes a feature that turns out to match an existing board ticket, even without naming the ID directly.
---

# Implement a ticket from the Build Board

This encodes the exact sequence used successfully for tickets T20 and T21a: look up the ticket,
confirm it's actually unblocked, branch correctly relative to whatever it depends on, research
before writing code, implement in the established style, verify narrow-to-wide, then ship and
close the loop on the board. Follow it in order — each step exists because skipping it caused a
real problem in an earlier session (a wasted Notion query, a re-read of files an agent had
already summarized, a PR opened against the wrong base, a migration bug that only e2e coverage
caught).

The ticket ID is the argument to this skill (e.g. `T21a`, `QB1`). If the user didn't give one,
ask which ticket, or offer to list unblocked ones from the board.

## 1. Look up the ticket

Query the Notion data source for the board directly:

```
data_source_urls: ["collection://19ad1af2-d0b8-4d48-804a-8efde2063a75"]
query: SELECT url, Name, Status, "Depends On", Track, "Order"
       FROM "collection://19ad1af2-d0b8-4d48-804a-8efde2063a75"
       WHERE Name LIKE '<ticket-id>%'
```

The card's title column is `Name` (e.g. `"T21a · Admin — round builder + advancement config"`),
not `"Card ID"` — querying a `"Card ID"` column fails, since no such column exists.

Then read the ticket's fuller description from the plan doc. It currently lives at
`C:\Users\hswea\.claude\plans\event-scoring-app-summary-linked-mccarthy.md`, but plan docs get
renamed across sessions (they did once already) — if grepping the ticket ID there comes up empty,
list `C:\Users\hswea\.claude\plans\*.md` and look for the one that mentions the Build Board /
event scoring app before assuming the ticket isn't documented. Grep for the ticket ID to get its
one-line description plus the surrounding paragraphs, which usually spell out the data model or
constraints the ticket needs to respect (e.g. T21a's line pointed at the `rounds` table's
`is_final_round = (advancement_n IS NULL)` invariant before any code was written).

## 2. Check dependencies

Every card lists its blockers in `Depends On` (e.g. `T8a, T20`). Query each one's `Status` the
same way. If any dependency isn't `Done`, stop here and tell the user which one is blocking —
don't start implementation on top of a foundation that doesn't exist yet.

## 3. Mark the card "In progress"

Before writing any code, flip the card's `Status` to `"In progress"` via `update_properties`. This
is a standing expectation for this board, not just tidiness — it's how the user tracks what's
actually being worked on versus queued.

## 4. Decide the git branch

This project's rule is: every ticket starts on its own new branch, and gets a PR when it's done.
The question worth pausing on is *what to branch off of*:

- If every dependency listed in step 2 has already been merged into `main`, branch off `main`
  (`git checkout main && git pull && git checkout -b feat/<ticket>-<short-slug>`).
- If a dependency's own implementation branch exists (locally or on `origin`) but hasn't been
  merged into `main` yet, branch off *that* branch instead — a stacked branch. Don't try to
  cherry-pick main and hope the dependency's code shows up some other way; it won't be there.
  T21a did this off `feat/t20-admin-event-crud-lifecycle` because T20 was done but not yet merged.
  Check with `git merge-base --is-ancestor <dep-branch> main` (empty exit code 0 means it's
  already in main; nonzero means it isn't).

When the PR eventually gets opened (step 8), the base branch must match whichever of these applies
— a stacked PR targets the dependency's branch, not `main`, and the PR description should say so
explicitly so the reviewer isn't confused by an unexpectedly large diff.

## 5. Research before writing code

Spawn an Explore (or general-purpose) agent to map out what this ticket touches: the relevant
Supabase migrations (schema, RLS policies, RPCs, triggers) it builds on, and the existing frontend
feature(s) whose conventions it should mirror (folder layout, how the `*-api.ts` file talks to
Supabase, which shared UI primitives to reuse, how e2e tests for that area are written).

The one thing worth being explicit about in the agent's prompt: ask it to include the **full,
verbatim contents** of any file the new work will need to pattern-match closely or will likely
need to edit — not just a prose description of what's in it. A summary like "events-api.ts has a
getErrorMessage helper and create/update/delete functions following pattern X" is useful for
orientation, but the `Edit` tool needs exact text to match against, so a summary alone means
re-reading the same file again once the agent's report comes back. Getting the verbatim source in
the first report avoids that second round trip. Files worth asking for verbatim in most tickets:
the sibling feature's `*-api.ts`, its `*-ui.tsx` (or the shared one it reuses), its main page
component, the app's router file, and the e2e helpers file.

## 6. Implement

Follow the conventions the research turned up rather than introducing new ones. Concretely, this
codebase's frontend features live under `src/features/<name>/` with:

- `types.ts` — plain TypeScript types mirroring the relevant DB rows.
- `<name>-api.ts` — plain async functions wrapping `supabase.from(...)` / `supabase.rpc(...)`
  calls, each throwing the Postgrest error on failure. No react-query, SWR, or other cache layer —
  callers hold loading/error/data in local `useState`. Each api file owns a small local
  `getErrorMessage(err, fallback)` helper rather than importing one from another feature.
- A page component (or a few) built from the shared Panda CSS primitives in
  `src/features/events/events-ui.tsx` and `src/features/auth/auth-ui.tsx` — no modal library, no
  bespoke component kit. Everything is a full page or a `Card` on a page. When a form's fields
  might legitimately collide with another form rendered on the same page (an "add" form and an
  "edit" form using the same field labels, say), gate them so only one renders at a time rather
  than disambiguating with different label text — it keeps the UI simpler and keeps e2e selectors
  unambiguous.

If the ticket needs a database change, scaffold the migration with the Supabase CLI —
`supabase migration new <name>` — never hand-write a migration filename with a guessed timestamp.
If `supabase` isn't resolving on PATH (a stale shell can miss a scoop-installed CLI), call the
shim directly: `C:\Users\hswea\scoop\shims\supabase.exe`. After writing the migration, apply it
with `supabase db push` (or the shim's full path) so it's live on the linked project before you
start testing against it.

## 7. Verify, narrow before wide

Run `npx tsc -b` and `npx eslint .` first — cheap, fast, catches most mistakes before anything
touches the real backend.

For behavior, write or extend a Playwright spec under `e2e/`. While iterating, run just that file
(`npm run test:e2e -- e2e/<your-spec>.spec.ts`) rather than the whole suite — it's faster to loop
on, and it was exactly this narrow re-run that caught a race condition in a test helper that
wasn't waiting for an async submit to settle before firing the next action. Once the new spec is
green on its own, run the full suite once (`npm run test:e2e`) to confirm nothing else regressed,
and treat that as the real gate before calling the ticket done.

If a test failure's error message points at the *backend* rather than the test (a trigger firing
when it shouldn't, a constraint rejecting a legitimate write), don't route around it in the test —
that's usually a real bug worth fixing with its own migration, the way T21a's e2e run surfaced a
cascade-delete bug in an existing draft-only-freeze trigger. Fix the root cause, add the migration,
push it, and let the test re-confirm.

Use the browser preview for a couple of targeted checks of things e2e assertions can't see —
layout, CSS states like a disabled/grayed-out field, responsive behavior — rather than clicking
through every flow the e2e suite just finished proving works. One or two screenshots of the
genuinely visual bits beats a full manual walkthrough that re-derives what the automated suite
already confirmed.

Before finishing, delete `test-results/` and `playwright-report/` if Playwright created them — 
they're local run artifacts, not something to commit.

## 8. Ship it

Commit with a message in this repo's existing style (a `type(scope): summary` subject, a body
explaining the *why* when it's not obvious, ending with the `Co-Authored-By: Claude Sonnet 5
<noreply@anthropic.com>` trailer). Push the branch, then open the PR:

```
C:\Users\hswea\scoop\shims\gh.exe pr create --base <branch from step 4> --head <this branch> \
  --title "..." --body "..."
```

(use the shim's full path if `gh` isn't resolving on PATH)

If the base isn't `main`, say so plainly near the top of the PR body — e.g. "this PR targets
`feat/t20-...` (not `main`) since that ticket hasn't merged yet and this one builds directly on
it." Include a test-plan checklist in the body listing what was actually run and checked (type
check, lint, the specific e2e coverage, any manual verification) — not a generic template, the
real list for this ticket.

## 9. Mark the card "Done"

Flip the Notion card's `Status` back via `update_properties`, closing the loop the same way step 3
opened it.

## 10. Report back

Tell the user what shipped, the PR link, and what — if anything — is now unblocked on the board as
a result (the same way finishing T21a unblocked QB1). Keep it to what changed and what's next; the
implementation detail already lives in the PR.

-- QA7 · Auto pre-mark matcher (normalize + acceptable list + numeric equivalence)
--
-- Ships the matcher the plan describes under "Answers & grading": "the
-- submitted answer is normalized (trim, case-insensitive, collapsed
-- punctuation) and matched against the question's acceptable-answer list
-- ... numeric answers compared by value where listed. This sets a
-- provisional auto_correct." QA10's grader later confirms or overrides this
-- into `final_correct`; QA7 only produces the provisional value.
--
-- Three pieces:
--   1. `private.normalize_answer_text` — trim + lowercase + strip punctuation
--      + collapse whitespace, shared by both sides of a text comparison.
--   2. `private.parse_numeric_answer` — best-effort numeric parse (strips
--      thousands separators and a leading currency symbol), returns null
--      rather than erroring on non-numeric input so a numeric-flagged
--      acceptable answer never blows up a batch match over mixed input.
--   3. `private.question_matches_acceptable_answer` — the predicate: true iff
--      the submission matches ANY of the question's acceptable answers,
--      comparing numerically when that row is `is_numeric`, normalized-text
--      otherwise.
--
-- These feed a single public RPC, `auto_mark_question_answers`, rather than
-- running per-submission inside QA6's `submit_answer`. Two reasons:
--   * QA6's upsert already excludes any answer whose `auto_correct` is set
--     (`... where final_correct is null and auto_correct is null`), i.e.
--     auto-marking an answer retires it from further edits the same way
--     grading does. Marking at submit time would lock out a same-window
--     resubmission or a legitimate grace-window replay (QA6) before either
--     could land — the matcher must not run until the question is done
--     accepting answers.
--   * "Done accepting answers" is `window_closed` *and* QA6's own 10s grace
--     period past that has elapsed too (window_closed_at can be stamped by
--     the organizer's close_question_window call at any point after
--     window_seconds elapses — an early call doesn't guarantee grace has
--     passed). This RPC re-checks that server-side rather than trusting the
--     caller's timing, mirroring QA6's own "server clock, not caller" stance.
--
-- Organizer-only, matching reveal_question/close_question_window. Before
-- writing, the transaction-local JWT claim is cleared (mirrors the
-- `answers_column_guard` trigger's documented "auth.uid() is null" bypass —
-- see QA2) so the write is unconditionally allowed by that trigger's
-- unrestricted "other roles" branch even in the edge case where the same
-- profile is both `organizer_id` and `events.grader_id`: without this, that
-- overlap would route the update through the trigger's grader branch, which
-- only permits `final_correct` to change and would reject `auto_correct`.
-- All `auth.uid()`-based authorization happens before the clear.
--
-- Not in scope here: void (QA8), round-close gate (QA9), the grader's
-- adjudication RPC that writes `final_correct` (QA10), the unbypassable
-- answers immutability trigger (QA11).

-- ---------------------------------------------------------------------------
-- 1. private.normalize_answer_text — trim, lowercase, strip punctuation,
--    collapse whitespace. Pure/deterministic, no table access.
-- ---------------------------------------------------------------------------
create or replace function private.normalize_answer_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(btrim(p_text)), '[[:punct:]]', '', 'g'),
      '\s+', ' ', 'g'
    ),
    ''
  )
$$;

comment on function private.normalize_answer_text(text) is
  'Normalizes answer text for comparison: trim, lowercase, strip punctuation, collapse internal whitespace. Returns null for null/blank/all-punctuation input so an unset comparison never accidentally equals another unset comparison.';

-- ---------------------------------------------------------------------------
-- 2. private.parse_numeric_answer — best-effort numeric parse; null (not an
--    error) on anything that isn't a number, so a numeric acceptable-answer
--    comparison degrades to "no match" rather than aborting the batch.
-- ---------------------------------------------------------------------------
create or replace function private.parse_numeric_answer(p_text text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  return replace(replace(btrim(p_text), ',', ''), '$', '')::numeric;
exception when others then
  return null;
end;
$$;

comment on function private.parse_numeric_answer(text) is
  'Best-effort numeric parse of an answer: strips thousands-separator commas and a leading dollar sign, then casts. Returns null (never raises) on input that isn''t a number.';

-- ---------------------------------------------------------------------------
-- 3. private.question_matches_acceptable_answer — the matcher predicate
-- ---------------------------------------------------------------------------
create or replace function private.question_matches_acceptable_answer(
  p_question_id    uuid,
  p_submitted_text text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.question_acceptable_answers a
    where a.question_id = p_question_id
      and (
        (
          a.is_numeric
          and private.parse_numeric_answer(p_submitted_text) is not null
          and private.parse_numeric_answer(a.value) is not null
          and private.parse_numeric_answer(a.value) = private.parse_numeric_answer(p_submitted_text)
        )
        or (
          not a.is_numeric
          and private.normalize_answer_text(a.value) is not null
          and private.normalize_answer_text(a.value) = private.normalize_answer_text(p_submitted_text)
        )
      )
  )
$$;

comment on function private.question_matches_acceptable_answer(uuid, text) is
  'True iff p_submitted_text matches any of the question''s acceptable answers — numeric value equality for an is_numeric row, normalized-text equality otherwise. False (never null) for a null/blank/no-match submission.';

grant execute on function private.normalize_answer_text(text) to authenticated;
grant execute on function private.parse_numeric_answer(text) to authenticated;
grant execute on function private.question_matches_acceptable_answer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. auto_mark_question_answers RPC — organizer-only batch pre-mark
-- ---------------------------------------------------------------------------
create or replace function public.auto_mark_question_answers(p_question_id uuid)
returns setof public.answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
  v_event_id uuid;
  v_grace    constant interval := interval '10 seconds';  -- must match submit_answer's (QA6) grace window
begin
  if auth.uid() is null then
    raise exception 'auto_mark_question_answers requires an authenticated organizer'
      using errcode = '42501';
  end if;

  select * into v_question from public.questions where id = p_question_id for update;

  if not found then
    raise exception 'question % not found', p_question_id
      using errcode = 'no_data_found';
  end if;

  select r.event_id into v_event_id
    from public.segments s
    join public.rounds r on r.id = s.round_id
    where s.id = v_question.segment_id;

  if not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may auto-mark question %', p_question_id
      using errcode = '42501';
  end if;

  if v_question.status is distinct from 'window_closed' then
    raise exception 'question % cannot be auto-marked from status % (must be window_closed)',
      p_question_id, v_question.status
      using errcode = 'check_violation';
  end if;

  if now() < v_question.window_closed_at + v_grace then
    raise exception
      'question %''s grace period has not elapsed yet; a reconnect replay may still land',
      p_question_id
      using errcode = 'check_violation';
  end if;

  -- Clear the request-scoped JWT claim (transaction-local; reverts at commit)
  -- so the write below lands as neither "owner" nor "grader" under
  -- answers_column_guard (QA2), regardless of whether this organizer is also
  -- events.grader_id for this event. All auth.uid()-based checks above have
  -- already run.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  return query
    update public.answers
      set auto_correct = private.question_matches_acceptable_answer(p_question_id, submitted_text),
          updated_at   = now()
      where question_id = p_question_id
        and final_correct is null
        and auto_correct is null
      returning *;
end;
$$;

comment on function public.auto_mark_question_answers(uuid) is
  'Batch auto pre-marks every ungraded, unmarked answer to a question: normalizes and matches submitted_text against the question''s acceptable-answer list (numeric equivalence for is_numeric rows), writing the result to auto_correct. Organizer-only. Requires the question to be window_closed and the same 10s grace period QA6''s submit_answer honors to have elapsed since window_closed_at, so a still-landing reconnect replay is never marked out from under itself. SECURITY DEFINER; clears the request JWT claim before writing so answers_column_guard''s owner/grader column rules never apply to this system write, even if the organizer is also this event''s grader.';

revoke all on function public.auto_mark_question_answers(uuid) from public;
grant execute on function public.auto_mark_question_answers(uuid) to authenticated;

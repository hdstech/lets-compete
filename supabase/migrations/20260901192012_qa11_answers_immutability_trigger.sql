-- QA11 · Answer immutability trigger
--
-- The plan's three enforcement layers for "an answers row locks when either
-- its question's window has closed or the round has been graded/calculated"
-- are: (1) app — the client only lets a participant edit in-window; (2) DB
-- trigger — "rejects a write whose question is past window_open (except the
-- grader's final_correct write, and except a within-grace replay ...).
-- Unbypassable even by a direct API call"; (3) RLS. QA2 shipped (3) and the
-- column-guard half of the picture; QA6/QA7/QA8/QA9/QA10 each enforce their
-- own slice of (2) inside their own SECURITY DEFINER bodies. This ticket
-- adds the actual BEFORE INSERT/UPDATE trigger on `answers` itself, so the
-- boundary holds even against a write that reaches the table through some
-- future or currently-unimagined entry point, not just the RPCs that happen
-- to check it today.
--
-- Three kinds of write are recognized and each gets its own rule:
--   * A grader write (only final_correct — and graded_by/graded_at/
--     updated_at — differs from OLD) is allowed at any time, UNLESS the
--     round already has a final round-scope result_calculations row (fully
--     "calculated" — the second half of the plan's lock condition).
--   * A content write (participant submit or reconnect/sendBeacon replay —
--     everything else, including a fresh INSERT) is allowed only while the
--     question's window (+ QA6's 10s grace) hasn't elapsed, and only while
--     the reported client_elapsed_ms is within the window. This mirrors
--     QA6's own `submit_answer` checks as a backstop that holds even if a
--     future write path forgets to re-derive them.
--   * A voided question (QA8) never accepts any write, full stop — its
--     answers were already deleted; this only matters for a hypothetical
--     re-insert attempt against a voided question_id.
--
-- Matches `answers_column_guard`'s existing convention: a null `auth.uid()`
-- (a service-role write, or QA7's own auto-mark write, which deliberately
-- clears the JWT claim before its UPDATE — see QA7's migration comment)
-- skips this trigger too; QA7's write is a third, system-authored column
-- (auto_correct) this trigger doesn't otherwise know about, and it's already
-- gated by QA7's own window_closed + grace check.

create or replace function private.enforce_answers_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question        public.questions%rowtype;
  v_grace  constant interval := interval '10 seconds';  -- must match QA6/QA7's grace window
  v_is_grader_write boolean;
  v_calculated      boolean;
begin
  -- service_role / QA7's claim-cleared system write: skip (matches
  -- answers_column_guard's own "uid is null" bypass).
  if auth.uid() is null then
    return new;
  end if;

  select * into v_question from public.questions where id = new.question_id;

  if not found then
    raise exception 'question % not found', new.question_id
      using errcode = 'no_data_found';
  end if;

  if v_question.status = 'voided' then
    raise exception 'question % has been voided; it no longer accepts answers', new.question_id
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    v_is_grader_write := (
      new.participant_id       is not distinct from old.participant_id
      and new.question_id      is not distinct from old.question_id
      and new.round_id         is not distinct from old.round_id
      and new.segment_id       is not distinct from old.segment_id
      and new.submitted_text   is not distinct from old.submitted_text
      and new.submitted_at     is not distinct from old.submitted_at
      and new.is_saved_draft   is not distinct from old.is_saved_draft
      and new.client_elapsed_ms is not distinct from old.client_elapsed_ms
      and new.auto_correct     is not distinct from old.auto_correct
      and new.final_correct    is distinct from old.final_correct
    );
  else
    v_is_grader_write := false;
  end if;

  if v_is_grader_write then
    select exists (
      select 1
      from public.result_calculations rc
      where rc.round_id = new.round_id
        and rc.segment_id is null
        and rc.is_final
    ) into v_calculated;

    if v_calculated then
      raise exception
        'answers for round % are locked: results have already been calculated',
        new.round_id
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- Content write (submit / reconnect / sendBeacon replay): must still be
  -- within the question's window + grace, with a plausible elapsed time.
  if v_question.revealed_at is null
     or now() > v_question.revealed_at + (v_question.window_seconds * interval '1 second') + v_grace
  then
    raise exception
      'answers for question % are locked: its answer window (plus grace) has closed',
      new.question_id
      using errcode = 'check_violation';
  end if;

  if new.client_elapsed_ms is null or new.client_elapsed_ms > v_question.window_seconds * 1000 then
    raise exception
      'answer for question % reports elapsed time outside its % s answer window',
      new.question_id, v_question.window_seconds
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function private.enforce_answers_immutability() is
  'BEFORE INSERT/UPDATE trigger fn for public.answers: the unbypassable backstop behind QA6 (submit)/QA10 (grade) — a content write must still be within its question''s window+grace with a plausible client_elapsed_ms; a grader write (only final_correct differs) is allowed unless the round already has a final result_calculations row; a voided question accepts nothing. Skipped when auth.uid() is null (service-role / QA7''s claim-cleared auto-mark write). Bound below.';

drop trigger if exists answers_immutability_guard on public.answers;
create trigger answers_immutability_guard
  before insert or update on public.answers
  for each row
  execute function private.enforce_answers_immutability();

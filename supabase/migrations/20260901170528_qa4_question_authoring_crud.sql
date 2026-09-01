-- QA4 · Question authoring CRUD (+ acceptable answers), draft-only
--
-- QA1 created `questions` and `question_acceptable_answers`; QA2 granted the
-- event organizer raw INSERT/UPDATE/DELETE on both via RLS. T8a already
-- covers this ticket's "segment" half (segments freeze totally once the
-- owning event leaves draft) and establishes the pattern this migration
-- follows for the remaining "question authoring" half:
--
--   1. `window_seconds` has no positivity check, mirroring the gap T8a
--      closed for `rounds.advancement_n`.
--   2. Questions are writable at any event status, which contradicts the
--      plan's "activate... freezes rounds/segments/questions" rule. But
--      unlike segments, a question has lifecycle columns of its own
--      (`status`, `reveal_token`, `revealed_at`, `window_closed_at`,
--      `voided_at`, `voided_by`) that QA5 (reveal) and QA8 (void) need to
--      keep writing after the event is active — including tiebreak
--      questions, which are authored in draft but only revealed during a
--      later sudden-death sub-flow. So, exactly like T8a's round guard, the
--      freeze applies only to the *authoring* surface (prompt, answer_type,
--      window_seconds, sequence, is_tiebreak, segment_id) and to adding or
--      removing questions outright — not to the lifecycle columns.
--   3. `question_acceptable_answers` has no lifecycle columns of its own
--      (same shape as segments), so its freeze is total once the owning
--      question's event has left draft.
--
-- No new RPCs: organizer CRUD already flows through QA2's RLS policies,
-- these constraints/triggers just constrain what that CRUD is allowed to
-- touch once an event leaves draft.

-- ---------------------------------------------------------------------------
-- 1. window_seconds must be positive
-- ---------------------------------------------------------------------------
alter table public.questions
  add constraint questions_window_seconds_positive
  check (window_seconds > 0);

-- ---------------------------------------------------------------------------
-- 2. questions: authoring surface freezes once the event has left draft;
--    lifecycle columns (status/reveal_token/revealed_at/window_closed_at/
--    voided_at/voided_by) stay writable for QA5/QA8's RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_question_draft_only()
returns trigger
language plpgsql
as $$
declare
  v_segment_id uuid;
  v_event_id   uuid;
  v_status     public.event_status;
begin
  v_segment_id := coalesce(new.segment_id, old.segment_id);

  select e.id, e.status into v_event_id, v_status
    from public.segments s
    join public.rounds r on r.id = s.round_id
    join public.events e on e.id = r.event_id
    where s.id = v_segment_id;

  if tg_op in ('INSERT', 'DELETE') then
    if v_status is distinct from 'draft' then
      raise exception
        'questions cannot be added or removed once event % has left draft (status %)',
        v_event_id, v_status
        using errcode = 'check_violation';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- UPDATE: only the authoring surface freezes; lifecycle columns are owned
  -- by other RPCs (reveal/void, QA5/QA8).
  if v_status is distinct from 'draft' and (
    new.segment_id     is distinct from old.segment_id
    or new.prompt         is distinct from old.prompt
    or new.answer_type    is distinct from old.answer_type
    or new.window_seconds is distinct from old.window_seconds
    or new.sequence        is distinct from old.sequence
    or new.is_tiebreak      is distinct from old.is_tiebreak
  ) then
    raise exception
      'question % authoring fields are frozen once its event has left draft (status %)',
      old.id, v_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_question_draft_only() is
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.questions: rejects adding/removing questions and rejects changes to a question''s authoring fields once the owning event has left draft; lifecycle columns (status/reveal_token/revealed_at/window_closed_at/voided_at/voided_by) stay writable for QA5/QA8''s RPCs. Bound below.';

drop trigger if exists questions_draft_only_guard on public.questions;
create trigger questions_draft_only_guard
  before insert or update or delete on public.questions
  for each row
  execute function public.enforce_question_draft_only();

-- ---------------------------------------------------------------------------
-- 3. question_acceptable_answers: no lifecycle columns of their own, so the
--    freeze is total once the owning question's event has left draft.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_question_acceptable_answer_draft_only()
returns trigger
language plpgsql
as $$
declare
  v_question_id uuid;
  v_status      public.event_status;
begin
  v_question_id := coalesce(new.question_id, old.question_id);

  select e.status into v_status
    from public.questions q
    join public.segments s on s.id = q.segment_id
    join public.rounds r on r.id = s.round_id
    join public.events e on e.id = r.event_id
    where q.id = v_question_id;

  if v_status is distinct from 'draft' then
    raise exception
      'acceptable answers are frozen once their event has left draft (status %)',
      v_status
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.enforce_question_acceptable_answer_draft_only() is
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.question_acceptable_answers: rejects any write once the owning event has left draft (acceptable answers have no lifecycle columns of their own, unlike questions). Bound below.';

drop trigger if exists question_acceptable_answers_draft_only_guard on public.question_acceptable_answers;
create trigger question_acceptable_answers_draft_only_guard
  before insert or update or delete on public.question_acceptable_answers
  for each row
  execute function public.enforce_question_acceptable_answer_draft_only();

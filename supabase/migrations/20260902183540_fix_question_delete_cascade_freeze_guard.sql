-- Fix: question/acceptable-answer draft-only guards blocking cascading
-- deletes, two levels deeper than the T21a round/segment fix
-- (20260902173438).
--
-- `segments.id -> questions.segment_id` and `questions.id ->
-- question_acceptable_answers.question_id` are both `on delete cascade`,
-- so deleting a draft event cascades: event -> rounds -> segments ->
-- questions -> question_acceptable_answers. By the time the cascade
-- reaches `questions`, the parent `segments`/`rounds`/`events` chain may
-- already be gone, so `enforce_question_draft_only`'s status lookup comes
-- back NULL, `v_status is distinct from 'draft'` is true, and it raises
-- "questions cannot be added or removed...", blocking a delete the RLS
-- layer already permits. Same bug, same shape, in
-- `enforce_question_acceptable_answer_draft_only` one level further down.
--
-- Fix: for a DELETE, a NULL status lookup means the parent chain has
-- already been removed in the same cascade, not that the event is somehow
-- in an unknown non-draft state. Let the cascade proceed in that case;
-- every other guard behavior (INSERT, UPDATE, and a real non-draft DELETE)
-- is unchanged.
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
    if tg_op = 'DELETE' and v_status is null then
      -- Parent segment/round/event row is already gone (cascading delete);
      -- nothing left to freeze against.
      return old;
    end if;
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
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.questions: rejects adding/removing questions and rejects changes to a question''s authoring fields once the owning event has left draft; lifecycle columns (status/reveal_token/revealed_at/window_closed_at/voided_at/voided_by) stay writable for QA5/QA8''s RPCs. A DELETE whose segment/round/event lookup comes back NULL means the parent row is already gone via cascade, and is allowed through. Bound in QA4.';

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

  if tg_op = 'DELETE' and v_status is null then
    -- Parent question/segment/round/event row is already gone (cascading
    -- delete); nothing left to freeze against.
    return old;
  end if;

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
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.question_acceptable_answers: rejects any write once the owning event has left draft (acceptable answers have no lifecycle columns of their own, unlike questions). A DELETE whose question/segment/round/event lookup comes back NULL means the parent row is already gone via cascade, and is allowed through. Bound in QA4.';

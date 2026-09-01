-- T6 · Event lifecycle RPC + guards
--
-- Delivers the first lifecycle transition: draft -> active. Per the plan,
-- domain logic for lifecycle transitions lives in guarded RPCs, not raw
-- table writes, so this ships as `activate_event()` rather than relying on
-- whatever table-level UPDATE grants a later RLS ticket adds.
--
-- Two guards:
--   1. `enforce_event_status_transition()` — a BEFORE UPDATE trigger on
--      `events.status`, same spirit as QA0's format-immutability trigger.
--      Only forward transitions are legal (draft -> active -> concluded);
--      this is a DB-level backstop that holds even if a future ticket grants
--      organizers raw UPDATE on `events` via RLS.
--   2. `activate_event(p_event_id)` — SECURITY DEFINER RPC that atomically
--      moves an event from draft to active. It is format-aware:
--        * quiz  — opens round 1 (`scoring_open`, `scoring_opened_at`).
--                  The participant roster is deliberately left untouched:
--                  per the plan, quiz keeps the roster open through
--                  activation and only freezes it at the first question
--                  reveal (QA5's concern, not this ticket's).
--        * judged — reserved for V2 (not built yet); raises rather than
--                  silently no-op, so a future caller can't mistake an
--                  unimplemented path for success.
--
-- Not in scope here: conclude_event (T17), round/segment CRUD (T8a),
-- anything about reveal or roster-freeze enforcement itself (QA5).

-- ---------------------------------------------------------------------------
-- 1. Status-transition guard
-- ---------------------------------------------------------------------------
create or replace function public.enforce_event_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'active')
      or (old.status = 'active' and new.status = 'concluded')
    ) then
      raise exception
        'invalid events.status transition: % -> %',
        old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_event_status_transition() is
  'BEFORE UPDATE trigger fn for public.events: only allows draft->active and active->concluded status transitions. Bound below.';

drop trigger if exists events_status_transition_guard on public.events;
create trigger events_status_transition_guard
  before update on public.events
  for each row
  execute function public.enforce_event_status_transition();

-- ---------------------------------------------------------------------------
-- 2. activate_event RPC
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: no RLS write policy exists for events/rounds yet (QA1
-- enabled RLS with no policies = deny-by-default), so the function must run
-- with the owner's rights and enforce its own authorization instead.
create or replace function public.activate_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  public.events%rowtype;
  v_round1 public.rounds%rowtype;
begin
  select * into v_event from public.events where id = p_event_id for update;

  if not found then
    raise exception 'event % not found', p_event_id
      using errcode = 'no_data_found';
  end if;

  if auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'only the event organizer may activate event %', p_event_id
      using errcode = '42501';
  end if;

  if v_event.status is distinct from 'draft' then
    raise exception 'event % cannot be activated from status % (must be draft)',
      p_event_id, v_event.status
      using errcode = 'check_violation';
  end if;

  if v_event.format = 'quiz' then
    select * into v_round1
      from public.rounds
      where event_id = p_event_id and sequence = 1
      for update;

    if not found then
      raise exception
        'event % has no round 1 configured; create a round before activating',
        p_event_id
        using errcode = 'check_violation';
    end if;

    if v_round1.status is distinct from 'pending' then
      raise exception 'round 1 of event % is not pending (status %)',
        p_event_id, v_round1.status
        using errcode = 'check_violation';
    end if;

    update public.rounds
      set status = 'scoring_open', scoring_opened_at = now()
      where id = v_round1.id;

    -- Quiz roster stays open here by design; it freezes at first reveal (QA5).
  elsif v_event.format = 'judged' then
    raise exception
      'judged format activation is not implemented (V2, reserved)'
      using errcode = '0A000';
  else
    raise exception 'unrecognized event format %', v_event.format
      using errcode = 'check_violation';
  end if;

  update public.events
    set status = 'active'
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

comment on function public.activate_event(uuid) is
  'Moves an event draft -> active. Format-aware: quiz opens round 1 and leaves the participant roster open (it freezes at first reveal, QA5); judged raises (V2, not built). Organizer-only.';

revoke all on function public.activate_event(uuid) from public;
grant execute on function public.activate_event(uuid) to authenticated;

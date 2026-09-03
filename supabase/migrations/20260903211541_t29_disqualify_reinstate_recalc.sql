-- T29 · Results — recalc after revoke/DQ + history
--
-- Ships the piece T16's calculate_results comment explicitly deferred:
-- "recalculation-after-DQ + history UI (T29)". Two things land here:
--
--   1. Disqualify/reinstate — participants.status (eligible|disqualified|
--      withdrawn, QA1) has had no writer anywhere in the app; admission
--      (approve/revoke, QA3) is a separate axis entirely (whether someone is
--      admitted at all vs. whether an admitted participant's answers still
--      count). "Recalc after ... DQ" requires DQ to exist first, so this
--      migration adds it: a BEFORE UPDATE transition guard (same shape as
--      QA3's admission_status guard) plus disqualify_participant /
--      reinstate_participant RPCs. Only eligible<->disqualified is opened up
--      here — nothing in the app sets `withdrawn` yet and no ticket
--      currently owns that flow, so it's deliberately left out of the
--      allowed-transition set rather than guessed at.
--
--   2. History is a read: T16's calculate_results already writes every run
--      as an immutable result_calculations row, flipping only the prior
--      row's is_final off rather than deleting it, so no schema change is
--      needed for "calculation history" — the frontend just needs to query
--      without the `is_final = true` filter T28's listFinalCalculations
--      uses. That's a T29 frontend change (results-api.ts / a new history
--      page), not part of this migration.
--
-- The actual "recalculate the scopes a DQ'd/revoked participant appeared in"
-- action is also a frontend concern: it's just calculate_results (T16),
-- called per affected scope with a p_reason describing why — the RPC has
-- accepted p_reason since T16 shipped, the frontend just hadn't threaded it
-- through yet.

-- ---------------------------------------------------------------------------
-- 1. participants.status transition guard
-- ---------------------------------------------------------------------------
create or replace function public.enforce_participant_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'eligible'      and new.status = 'disqualified')
      or (old.status = 'disqualified' and new.status = 'eligible')
    ) then
      raise exception
        'invalid participants.status transition: % -> %',
        old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_participant_status_transition() is
  'BEFORE UPDATE trigger fn for public.participants: only allows eligible<->disqualified status transitions (disqualify/reinstate). withdrawn has no writer yet and is deliberately excluded pending whatever ticket eventually owns self-withdrawal. Bound below.';

drop trigger if exists participants_status_guard on public.participants;
create trigger participants_status_guard
  before update on public.participants
  for each row
  execute function public.enforce_participant_status_transition();

-- ---------------------------------------------------------------------------
-- 2. disqualify_participant / reinstate_participant RPCs
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER + explicit organizer check, matching QA3's
-- approve_participant / revoke_participant exactly.
create or replace function public.disqualify_participant(p_participant_id uuid)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants%rowtype;
begin
  select * into v_participant
    from public.participants
    where id = p_participant_id
    for update;

  if not found then
    raise exception 'participant % not found', p_participant_id
      using errcode = 'no_data_found';
  end if;

  if auth.uid() is null or not private.is_event_organizer(v_participant.event_id) then
    raise exception 'only the event organizer may disqualify participant %', p_participant_id
      using errcode = '42501';
  end if;

  if v_participant.status is distinct from 'eligible' then
    raise exception 'participant % cannot be disqualified from status %',
      p_participant_id, v_participant.status
      using errcode = 'check_violation';
  end if;

  update public.participants
    set status = 'disqualified'
    where id = p_participant_id
    returning * into v_participant;

  return v_participant;
end;
$$;

comment on function public.disqualify_participant(uuid) is
  'Disqualifies an eligible participant (status = disqualified), excluding them from calculate_results on the next run. Organizer-only.';

revoke all on function public.disqualify_participant(uuid) from public;
grant execute on function public.disqualify_participant(uuid) to authenticated;

create or replace function public.reinstate_participant(p_participant_id uuid)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants%rowtype;
begin
  select * into v_participant
    from public.participants
    where id = p_participant_id
    for update;

  if not found then
    raise exception 'participant % not found', p_participant_id
      using errcode = 'no_data_found';
  end if;

  if auth.uid() is null or not private.is_event_organizer(v_participant.event_id) then
    raise exception 'only the event organizer may reinstate participant %', p_participant_id
      using errcode = '42501';
  end if;

  if v_participant.status is distinct from 'disqualified' then
    raise exception 'participant % cannot be reinstated from status %',
      p_participant_id, v_participant.status
      using errcode = 'check_violation';
  end if;

  update public.participants
    set status = 'eligible'
    where id = p_participant_id
    returning * into v_participant;

  return v_participant;
end;
$$;

comment on function public.reinstate_participant(uuid) is
  'Reverses a disqualification (status back to eligible). Organizer-only.';

revoke all on function public.reinstate_participant(uuid) from public;
grant execute on function public.reinstate_participant(uuid) to authenticated;

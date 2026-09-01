-- QA3 · Participant admin-approve + identity RPC
--
-- T10 already ships self-register (`join_event`): a valid `join_code` gets
-- the caller a `pending` participants row. This ticket delivers the two
-- pieces T10 explicitly deferred:
--
--   1. Admin approve/revoke — `approve_participant` / `revoke_participant`,
--      SECURITY DEFINER RPCs, organizer-only, same shape as T6's
--      `activate_event`. QA2's `participants_update_organizer` policy
--      already lets the organizer UPDATE any column via raw PostgREST, so a
--      `BEFORE UPDATE` transition guard (same spirit as T6's
--      `enforce_event_status_transition`) makes the admission_status state
--      machine unbypassable regardless of entry point, not just enforced by
--      the RPCs.
--   2. Identity RPC — `my_participant_identity(p_join_code)`: given a join
--      code, returns the calling user's own participant row for that event,
--      or SQL NULL if they haven't registered yet. RLS already lets a
--      participant SELECT their own row, but only once they know the
--      event's id; this resolves "who am I in this event" from just the
--      code a participant actually holds (e.g. after a lost session), in
--      one round trip.
--
-- Not in scope here: roster-freeze-at-first-reveal enforcement. Per T6's
-- own comment, that gate belongs to QA5 (the reveal RPC) — QA3 predates any
-- mechanism that marks a round's first reveal, so approve/revoke here are
-- not gated on it, consistent with T6 leaving the same gap for activation.

-- ---------------------------------------------------------------------------
-- 1. admission_status transition guard
-- ---------------------------------------------------------------------------
-- pending is the only insert-time value (T10's join_event); admins move a
-- participant between approved/revoked in either direction (re-admitting a
-- revoked participant is a legitimate correction), but never back to
-- pending.
create or replace function public.enforce_admission_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.admission_status is distinct from old.admission_status then
    if not (
      (old.admission_status = 'pending'  and new.admission_status in ('approved', 'revoked'))
      or (old.admission_status = 'approved' and new.admission_status = 'revoked')
      or (old.admission_status = 'revoked'  and new.admission_status = 'approved')
    ) then
      raise exception
        'invalid participants.admission_status transition: % -> %',
        old.admission_status, new.admission_status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_admission_status_transition() is
  'BEFORE UPDATE trigger fn for public.participants: only allows pending->approved, pending->revoked, and approved<->revoked admission_status transitions. Bound below.';

drop trigger if exists participants_admission_status_guard on public.participants;
create trigger participants_admission_status_guard
  before update on public.participants
  for each row
  execute function public.enforce_admission_status_transition();

-- ---------------------------------------------------------------------------
-- 2. approve_participant / revoke_participant RPCs
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER + explicit organizer check, same rationale as T6's
-- activate_event: these could run as plain organizer UPDATEs under QA2's
-- existing RLS, but a guarded RPC is the documented, guard-checked entry
-- point the frontend calls (the transition trigger above is the backstop
-- for any other entry point).
create or replace function public.approve_participant(p_participant_id uuid)
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
    raise exception 'only the event organizer may approve participant %', p_participant_id
      using errcode = '42501';
  end if;

  if v_participant.admission_status not in ('pending', 'revoked') then
    raise exception 'participant % cannot be approved from admission_status %',
      p_participant_id, v_participant.admission_status
      using errcode = 'check_violation';
  end if;

  update public.participants
    set admission_status = 'approved'
    where id = p_participant_id
    returning * into v_participant;

  return v_participant;
end;
$$;

comment on function public.approve_participant(uuid) is
  'Admits a pending (or re-admits a revoked) participant into admission_status = approved. Organizer-only.';

revoke all on function public.approve_participant(uuid) from public;
grant execute on function public.approve_participant(uuid) to authenticated;

create or replace function public.revoke_participant(p_participant_id uuid)
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
    raise exception 'only the event organizer may revoke participant %', p_participant_id
      using errcode = '42501';
  end if;

  if v_participant.admission_status not in ('pending', 'approved') then
    raise exception 'participant % cannot be revoked from admission_status %',
      p_participant_id, v_participant.admission_status
      using errcode = 'check_violation';
  end if;

  update public.participants
    set admission_status = 'revoked'
    where id = p_participant_id
    returning * into v_participant;

  return v_participant;
end;
$$;

comment on function public.revoke_participant(uuid) is
  'Denies or removes a pending/approved participant by setting admission_status = revoked. Organizer-only.';

revoke all on function public.revoke_participant(uuid) from public;
grant execute on function public.revoke_participant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. my_participant_identity RPC
-- ---------------------------------------------------------------------------
create or replace function public.my_participant_identity(p_join_code text)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id    uuid;
  v_uid         uuid := auth.uid();
  v_participant public.participants%rowtype;
begin
  if v_uid is null then
    raise exception 'my_participant_identity requires an authenticated user'
      using errcode = '42501';
  end if;

  select id into v_event_id from public.events where join_code = p_join_code;

  if not found then
    raise exception 'invalid join code'
      using errcode = 'no_data_found';
  end if;

  select * into v_participant
    from public.participants
    where event_id = v_event_id and user_id = v_uid;

  if not found then
    return null;
  end if;

  return v_participant;
end;
$$;

comment on function public.my_participant_identity(text) is
  'Resolves the calling user''s own participant row (admission_status included) for the event matching p_join_code. Returns NULL if the code is valid but the caller has not joined. Raises on an unknown join_code.';

revoke all on function public.my_participant_identity(text) from public;
grant execute on function public.my_participant_identity(text) to authenticated;

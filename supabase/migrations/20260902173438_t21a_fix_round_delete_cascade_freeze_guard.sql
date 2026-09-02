-- T21a · fix round/segment draft-only guards blocking cascading deletes
--
-- Discovered while building the round builder UI: deleting a draft event
-- that owns rounds always failed. `events.id -> rounds.event_id` is
-- `on delete cascade`, so deleting an event cascades into a DELETE on each
-- of its rounds, which fires `rounds_draft_only_guard` (T8a). That trigger
-- looks up the owning event's status via
-- `select status into v_status from events where id = v_event_id`, but by
-- the time the cascade reaches `rounds`, the parent `events` row is already
-- gone — so `v_status` comes back NULL, `v_status is distinct from 'draft'`
-- is true, and the guard raises `rounds cannot be added or removed once
-- event % has left draft (status <NULL>)`, blocking a delete the RLS layer
-- (`events_delete_organizer`) already permits.
--
-- `segments.round_id -> rounds.id` is likewise `on delete cascade`, so the
-- same latent bug exists in `enforce_segment_draft_only()` once a round
-- with segments is deleted (directly, or via the same event-delete
-- cascade) — the round row backing its status lookup can already be gone.
--
-- Fix: for a DELETE, a NULL status lookup means the parent row has already
-- been removed in the same cascade, not that the event is somehow in an
-- unknown non-draft state. Let the cascade proceed in that case; every
-- other guard behavior (INSERT, UPDATE, and a real non-draft DELETE) is
-- unchanged.

create or replace function public.enforce_round_draft_only()
returns trigger
language plpgsql
as $$
declare
  v_event_id uuid;
  v_status   public.event_status;
begin
  v_event_id := coalesce(new.event_id, old.event_id);
  select status into v_status from public.events where id = v_event_id;

  if tg_op in ('INSERT', 'DELETE') then
    if tg_op = 'DELETE' and v_status is null then
      -- Parent event row is already gone (cascading delete); nothing left
      -- to freeze against.
      return old;
    end if;
    if v_status is distinct from 'draft' then
      raise exception
        'rounds cannot be added or removed once event % has left draft (status %)',
        v_event_id, v_status
        using errcode = 'check_violation';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- UPDATE: only the config surface freezes; round-lifecycle columns are
  -- owned by other RPCs (activate_event today, advance_round later).
  if v_status is distinct from 'draft' and (
    new.event_id         is distinct from old.event_id
    or new.name              is distinct from old.name
    or new.sequence          is distinct from old.sequence
    or new.advancement_type  is distinct from old.advancement_type
    or new.advancement_n     is distinct from old.advancement_n
    or new.is_final_round    is distinct from old.is_final_round
  ) then
    raise exception
      'round % config is frozen once event % has left draft (status %)',
      old.id, v_event_id, v_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_round_draft_only() is
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.rounds: rejects adding/removing rounds and rejects changes to a round''s config columns once the owning event has left draft; round-lifecycle columns (status/opened/closed/advanced) stay writable for later RPCs. A DELETE whose event lookup comes back NULL means the parent event row is already gone via cascade, and is allowed through. Bound below.';

create or replace function public.enforce_segment_draft_only()
returns trigger
language plpgsql
as $$
declare
  v_round_id uuid;
  v_status   public.event_status;
begin
  v_round_id := coalesce(new.round_id, old.round_id);

  select e.status into v_status
    from public.rounds r
    join public.events e on e.id = r.event_id
    where r.id = v_round_id;

  if tg_op = 'DELETE' and v_status is null then
    -- Parent round (or its event) row is already gone (cascading delete);
    -- nothing left to freeze against.
    return old;
  end if;

  if v_status is distinct from 'draft' then
    raise exception
      'segments are frozen once their event has left draft (status %)',
      v_status
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.enforce_segment_draft_only() is
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.segments: rejects any write once the owning event has left draft (segments have no lifecycle columns of their own, unlike rounds). A DELETE whose round/event lookup comes back NULL means the parent row is already gone via cascade, and is allowed through. Bound below.';

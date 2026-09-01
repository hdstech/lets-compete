-- T8a · Round CRUD + advancement config
--
-- QA1 created `rounds` with one structural check (`is_final_round =
-- (advancement_n is null)`), and QA2 granted the event organizer raw
-- INSERT/UPDATE/DELETE on rounds/segments via RLS. Two gaps remain, both
-- flagged by T6's migration comment as "not in scope here: round/segment
-- CRUD (T8a)":
--
--   1. `advancement_n` has no positivity check, and nothing stops an event
--      from having zero or several `is_final_round` rows — `declare_winner`
--      (T16a) will need exactly one unambiguous final round per event.
--   2. Rounds/segments are writable at any event status, which contradicts
--      the plan's "activate... freezes rounds/segments/questions" rule.
--      A blanket freeze can't just reject every UPDATE though: once an
--      event is active, round-lifecycle RPCs (T6's activate_event today;
--      advance_round/T16a later) still need to flip a round's own
--      `status`/`scoring_opened_at`/`scoring_closed_at`/`advanced_at` as
--      play progresses. So the freeze only applies to the *configuration*
--      surface (name, sequence, advancement_type, advancement_n,
--      is_final_round, event_id / round_id) — the part an organizer edits
--      in `draft` — and to adding or removing rounds/segments outright.
--
-- No new RPCs: organizer CRUD already flows through QA2's RLS policies,
-- these triggers just constrain what that CRUD is allowed to touch once an
-- event leaves draft.

-- ---------------------------------------------------------------------------
-- 1. advancement_n must be positive when set
-- ---------------------------------------------------------------------------
alter table public.rounds
  add constraint rounds_advancement_n_positive
  check (advancement_n is null or advancement_n > 0);

-- ---------------------------------------------------------------------------
-- 2. At most one final round per event
-- ---------------------------------------------------------------------------
create unique index rounds_one_final_per_event
  on public.rounds (event_id)
  where is_final_round;

-- ---------------------------------------------------------------------------
-- 3. rounds: config freezes once the event has left draft; lifecycle
--    columns (status/opened/closed/advanced) stay writable for later RPCs.
-- ---------------------------------------------------------------------------
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
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.rounds: rejects adding/removing rounds and rejects changes to a round''s config columns once the owning event has left draft; round-lifecycle columns (status/opened/closed/advanced) stay writable for later RPCs. Bound below.';

drop trigger if exists rounds_draft_only_guard on public.rounds;
create trigger rounds_draft_only_guard
  before insert or update or delete on public.rounds
  for each row
  execute function public.enforce_round_draft_only();

-- ---------------------------------------------------------------------------
-- 4. segments: no lifecycle columns of their own, so the freeze is total
--    once the owning event has left draft.
-- ---------------------------------------------------------------------------
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
  'BEFORE INSERT/UPDATE/DELETE trigger fn for public.segments: rejects any write once the owning event has left draft (segments have no lifecycle columns of their own, unlike rounds). Bound below.';

drop trigger if exists segments_draft_only_guard on public.segments;
create trigger segments_draft_only_guard
  before insert or update or delete on public.segments
  for each row
  execute function public.enforce_segment_draft_only();

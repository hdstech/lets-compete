-- T16 · calculate_results() — quiz branch
--
-- Ships the shared results engine's write path for V1: "Deliberate admin
-- action, never live. calculate_results for a scope: select the scope's
-- answers, exclude non-eligible participants and (for round/segment scopes)
-- only the round's active participants; per-participant total = sum of
-- final_correct (quiz); RANK() OVER (ORDER BY total DESC); write a new
-- result_calculations header + exclusion snapshot + frozen
-- result_calculation_entries, flipping any prior is_final for that scope to
-- false; no-op on unchanged input."
--
-- Scope shape (mirrors QA1's `result_calculations` comment):
--   * p_round_id set, p_segment_id set   -> per-segment leaderboard
--   * p_round_id set, p_segment_id null  -> per-round leaderboard
--   * both null                          -> event-overall. Per the plan,
--     "MVP = final round result": this resolves to the event's
--     `is_final_round` round internally for scoring, but is stored with
--     round_id/segment_id both null so it occupies the event-overall scope
--     slot (and so `T28`'s overall leaderboard query doesn't need to know
--     which round happened to be final).
--
-- `round_participants` gap: nothing seeds round 1's rows yet (T6's
-- activate_event deliberately leaves the roster/round_participants alone;
-- T16a's advance_round is what seeds round 2+ with only the participants who
-- advanced). `private.result_scope_totals` below treats an unseeded round
-- (zero round_participants rows for it) as "every eligible, approved
-- participant of the event is active", and a seeded round (T16a has run) as
-- authoritative via its explicit `active` rows. This is the only way round
-- 1 produces a result at all today; T16a's author should keep it in mind
-- when seeding round 2+.
--
-- Grading-complete guard: refuses to calculate while any answer in the
-- target round still has `final_correct is null` — a partial adjudication
-- would otherwise silently score an ungraded answer as 0, indistinguishable
-- from a genuinely wrong one.
--
-- "No-op on unchanged input": compares the freshly computed
-- (participant_id, total_score, rank) set against the scope's current
-- `is_final` entries; if identical, returns that existing calculation
-- untouched rather than writing a duplicate history row.
--
-- Organizer-only, matching reveal/void/close_round's authorization model.
--
-- Not in scope here: advance_round / declare_winner / tiebreak (T16a /
-- QA12), recalculation-after-DQ + history UI (T29).

-- ---------------------------------------------------------------------------
-- 1. private.result_scope_totals — per-participant sum(final_correct) for a
--    resolved round (+ optional segment), applying the eligibility /
--    round-active filtering described above.
-- ---------------------------------------------------------------------------
create or replace function private.result_scope_totals(
  p_event_id         uuid,
  p_target_round_id  uuid,
  p_segment_id       uuid  -- nullable: null = whole round, set = one segment
)
returns table (participant_id uuid, total_score integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(count(a.id) filter (where a.final_correct), 0)::integer
  from public.participants p
  left join public.answers a
    on a.participant_id = p.id
   and a.round_id = p_target_round_id
   and (p_segment_id is null or a.segment_id = p_segment_id)
  where p.event_id = p_event_id
    and p.status = 'eligible'
    and p.admission_status = 'approved'
    and (
      not exists (
        select 1 from public.round_participants rp where rp.round_id = p_target_round_id
      )
      or exists (
        select 1 from public.round_participants rp
        where rp.round_id = p_target_round_id
          and rp.participant_id = p.id
          and rp.status = 'active'
      )
    )
  group by p.id
$$;

comment on function private.result_scope_totals(uuid, uuid, uuid) is
  'Per-participant sum(final_correct) for p_target_round_id (optionally narrowed to one segment), restricted to eligible+approved participants who are active in that round. A round with zero round_participants rows (never seeded, e.g. round 1) is treated as every eligible/approved participant being active; a seeded round (T16a onward) is authoritative via its explicit active rows.';

grant execute on function private.result_scope_totals(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. calculate_results RPC
-- ---------------------------------------------------------------------------
create or replace function public.calculate_results(
  p_event_id   uuid,
  p_round_id   uuid default null,
  p_segment_id uuid default null,
  p_reason     text default null
)
returns public.result_calculations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_round_id uuid;
  v_round            public.rounds%rowtype;
  v_ungraded_count   integer;
  v_current_calc_id  uuid;
  v_unchanged        boolean;
  v_calculation      public.result_calculations%rowtype;
begin
  if auth.uid() is null or not private.is_event_organizer(p_event_id) then
    raise exception 'only the event organizer may calculate results for event %', p_event_id
      using errcode = '42501';
  end if;

  if p_segment_id is not null and p_round_id is null then
    raise exception 'p_segment_id requires p_round_id (a per-segment scope must name its round)'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_round_id is not null then
    select * into v_round from public.rounds where id = p_round_id;

    if not found or v_round.event_id is distinct from p_event_id then
      raise exception 'round % does not belong to event %', p_round_id, p_event_id
        using errcode = 'check_violation';
    end if;

    if p_segment_id is not null and not exists (
      select 1 from public.segments where id = p_segment_id and round_id = p_round_id
    ) then
      raise exception 'segment % does not belong to round %', p_segment_id, p_round_id
        using errcode = 'check_violation';
    end if;

    v_target_round_id := p_round_id;
  else
    select r.* into v_round
      from public.rounds r
      where r.event_id = p_event_id and r.is_final_round
      limit 1;

    if not found then
      raise exception 'event % has no final round configured', p_event_id
        using errcode = 'check_violation';
    end if;

    v_target_round_id := v_round.id;
  end if;

  if v_round.status not in ('scoring_closed', 'advanced') then
    raise exception
      'round % has not finished scoring (status %); calculate_results requires scoring_closed or advanced',
      v_target_round_id, v_round.status
      using errcode = 'check_violation';
  end if;

  select count(*) into v_ungraded_count
    from public.answers
    where round_id = v_target_round_id
      and final_correct is null;

  if v_ungraded_count > 0 then
    raise exception
      'round % has % answer(s) not yet graded; adjudicate the full round before calculating',
      v_target_round_id, v_ungraded_count
      using errcode = 'check_violation';
  end if;

  -- Locate the scope's current is_final calculation (if any) for the no-op check.
  select id into v_current_calc_id
    from public.result_calculations
    where event_id = p_event_id
      and round_id is not distinct from p_round_id
      and segment_id is not distinct from p_segment_id
      and is_final;

  select not exists (
    (
      select participant_id, total_score, rank() over (order by total_score desc) as rank
      from private.result_scope_totals(p_event_id, v_target_round_id, p_segment_id)
      except
      select participant_id, total_score, rank
      from public.result_calculation_entries
      where calculation_id = v_current_calc_id
    )
    union all
    (
      select participant_id, total_score, rank
      from public.result_calculation_entries
      where calculation_id = v_current_calc_id
      except
      select participant_id, total_score, rank() over (order by total_score desc) as rank
      from private.result_scope_totals(p_event_id, v_target_round_id, p_segment_id)
    )
  ) into v_unchanged;

  if v_current_calc_id is not null and v_unchanged then
    select * into v_calculation from public.result_calculations where id = v_current_calc_id;
    return v_calculation;
  end if;

  -- Something changed (or this is the scope's first calculation): flip any
  -- prior is_final off, write the new header + frozen entries + exclusion
  -- snapshot, and return the new header.
  update public.result_calculations
    set is_final = false
    where event_id = p_event_id
      and round_id is not distinct from p_round_id
      and segment_id is not distinct from p_segment_id
      and is_final;

  insert into public.result_calculations (
    event_id, round_id, segment_id, calculated_by, reason, is_final
  ) values (
    p_event_id, p_round_id, p_segment_id, auth.uid(), p_reason, true
  )
  returning * into v_calculation;

  insert into public.result_calculation_entries (calculation_id, participant_id, total_score, rank)
    select v_calculation.id, participant_id, total_score,
           rank() over (order by total_score desc)
    from private.result_scope_totals(p_event_id, v_target_round_id, p_segment_id);

  insert into public.result_calculation_exclusions (calculation_id, excluded_type, excluded_id, note)
    select
      v_calculation.id,
      'participant',
      p.id,
      case
        when p.status <> 'eligible' then 'participant status: ' || p.status
        when p.admission_status <> 'approved' then 'participant not approved'
        else 'not active in round'
      end
    from public.participants p
    where p.event_id = p_event_id
      and p.id not in (
        select participant_id from private.result_scope_totals(p_event_id, v_target_round_id, p_segment_id)
      );

  return v_calculation;
end;
$$;

comment on function public.calculate_results(uuid, uuid, uuid, text) is
  'Deliberate, versioned results calculation (quiz branch). Scope: both p_round_id/p_segment_id null = event-overall (resolves internally to the event''s final round, MVP semantics); p_round_id set + p_segment_id null = per-round; both set = per-segment. Requires the target round to have finished scoring (scoring_closed/advanced) with no ungraded answers. Writes a new result_calculations header (flipping any prior is_final for the same scope), frozen result_calculation_entries (RANK() OVER total DESC), and a result_calculation_exclusions snapshot — unless the computed entries exactly match the scope''s current is_final set, in which case it no-ops and returns that existing calculation. Organizer-only.';

revoke all on function public.calculate_results(uuid, uuid, uuid, text) from public;
grant execute on function public.calculate_results(uuid, uuid, uuid, text) to authenticated;

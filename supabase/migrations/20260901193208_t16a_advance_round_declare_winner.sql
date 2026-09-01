-- T16a · advance_round + declare_winner RPC
--
-- Ships the two admin actions that consume T16's `calculate_results` output:
-- "advance_round reads the round's is_final per-round entries, advances
-- rank <= N (tie expands / triggers tiebreak), writes round_participants,
-- seeds + opens the next round, or declares the winner on the final round."
--
-- Two public RPCs, sharing one private helper:
--   * `advance_round(p_round_id)` — non-final rounds only (raises, pointing
--     at declare_winner, if called on the final round). Requires the round
--     scoring_closed with a final round-scope calculation already run.
--     Writes round_participants for the CURRENT round (rank <= advancement_n
--     -> advanced, else eliminated — RANK()'s own tie semantics already
--     implement "a tie straddling the cutoff expands the field: all tied
--     advance", nothing extra needed here), seeds the NEXT round's
--     round_participants with the advancing set (status active — this is
--     what fixes T16's documented "round_participants unseeded" gap for
--     round 2 onward), and opens it (scoring_open).
--   * `declare_winner(p_event_id)` — the final-round equivalent: requires
--     the event's `is_final_round` scoring_closed with a final calculation,
--     and requires an UNTIED rank 1. "Final round's rank-1 = champion
--     (co-champions on a rank-1 tie, flagged)" — but `events` only has a
--     single `winner_participant_id` slot, and V1's build order puts the
--     sudden-death tiebreak sub-flow that resolves a rank-1 tie in a later
--     ticket (QA12, "reserve pool ... one at a time ... falls back to
--     co-advance/co-champion if the pool is exhausted"). Rather than invent
--     an ad hoc co-champion representation here, a tied rank 1 raises,
--     directing the admin at the tiebreak flow; QA12 is what's expected to
--     narrow it to one before declare_winner is called again.
--
-- Neither RPC changes `events.status` — that's T17's conclude RPC, kept as
-- its own terminal, one-way transition.
--
-- Not in scope here: the sudden-death tiebreak sub-flow itself (QA12), the
-- conclude RPC (T17).

-- ---------------------------------------------------------------------------
-- 1. private.write_round_advancement_outcomes — shared by both RPCs below
-- ---------------------------------------------------------------------------
create or replace function private.write_round_advancement_outcomes(
  p_round_id       uuid,
  p_calculation_id uuid,
  p_cutoff_rank    integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.round_participants (round_id, participant_id, status, advanced_by_calculation_id, updated_at)
    select
      p_round_id,
      e.participant_id,
      case when e.rank <= p_cutoff_rank then 'advanced' else 'eliminated' end,
      p_calculation_id,
      now()
    from public.result_calculation_entries e
    where e.calculation_id = p_calculation_id
  on conflict (round_id, participant_id) do update
    set status                     = excluded.status,
        advanced_by_calculation_id = excluded.advanced_by_calculation_id,
        updated_at                 = now();
end;
$$;

comment on function private.write_round_advancement_outcomes(uuid, uuid, integer) is
  'Upserts round_participants for every participant in a calculation''s frozen entries: rank <= p_cutoff_rank becomes advanced, the rest eliminated (ties at the cutoff naturally co-advance via RANK()''s own gap semantics). Shared by advance_round (cutoff = the round''s advancement_n) and declare_winner (cutoff = 1).';

-- ---------------------------------------------------------------------------
-- 2. advance_round RPC
-- ---------------------------------------------------------------------------
create or replace function public.advance_round(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round        public.rounds%rowtype;
  v_event_status public.event_status;
  v_calc_id      uuid;
  v_next_round   public.rounds%rowtype;
begin
  select * into v_round from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'round % not found', p_round_id
      using errcode = 'no_data_found';
  end if;

  select status into v_event_status from public.events where id = v_round.event_id;

  if auth.uid() is null or not private.is_event_organizer(v_round.event_id) then
    raise exception 'only the event organizer may advance round %', p_round_id
      using errcode = '42501';
  end if;

  if v_event_status is distinct from 'active' then
    raise exception 'round % belongs to an event that is not active (status %)',
      p_round_id, v_event_status
      using errcode = 'check_violation';
  end if;

  if v_round.is_final_round then
    raise exception 'round % is the final round; call declare_winner instead of advance_round', p_round_id
      using errcode = 'check_violation';
  end if;

  if v_round.status is distinct from 'scoring_closed' then
    raise exception 'round % cannot be advanced from status % (must be scoring_closed)',
      p_round_id, v_round.status
      using errcode = 'check_violation';
  end if;

  select id into v_calc_id
    from public.result_calculations
    where event_id = v_round.event_id
      and round_id = p_round_id
      and segment_id is null
      and is_final;

  if v_calc_id is null then
    raise exception 'round % has no final calculated results yet; run calculate_results first', p_round_id
      using errcode = 'check_violation';
  end if;

  select * into v_next_round
    from public.rounds
    where event_id = v_round.event_id and sequence = v_round.sequence + 1
    for update;

  if not found then
    raise exception 'round % has no next round configured (expected sequence %)',
      p_round_id, v_round.sequence + 1
      using errcode = 'check_violation';
  end if;

  if v_next_round.status is distinct from 'pending' then
    raise exception 'next round % is not pending (status %); round % may have already advanced',
      v_next_round.id, v_next_round.status, p_round_id
      using errcode = 'check_violation';
  end if;

  perform private.write_round_advancement_outcomes(p_round_id, v_calc_id, v_round.advancement_n);

  insert into public.round_participants (round_id, participant_id, status, updated_at)
    select v_next_round.id, rp.participant_id, 'active', now()
    from public.round_participants rp
    where rp.round_id = p_round_id and rp.status = 'advanced'
  on conflict (round_id, participant_id) do nothing;

  update public.rounds
    set status = 'scoring_open', scoring_opened_at = now()
    where id = v_next_round.id;

  update public.rounds
    set status = 'advanced', advanced_at = now()
    where id = p_round_id
    returning * into v_round;

  return v_round;
end;
$$;

comment on function public.advance_round(uuid) is
  'Advances a scoring_closed, non-final round: writes round_participants outcomes from its final calculate_results entries (rank <= advancement_n -> advanced; ties at the cutoff co-advance), seeds the next round''s round_participants with the advancing set, opens the next round (scoring_open), and marks this round advanced. Raises if called on the final round (use declare_winner) or before calculate_results has run. Organizer-only.';

revoke all on function public.advance_round(uuid) from public;
grant execute on function public.advance_round(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. declare_winner RPC
-- ---------------------------------------------------------------------------
create or replace function public.declare_winner(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event        public.events%rowtype;
  v_final_round  public.rounds%rowtype;
  v_calc_id      uuid;
  v_winner_count integer;
  v_winner_id    uuid;
begin
  select * into v_event from public.events where id = p_event_id for update;

  if not found then
    raise exception 'event % not found', p_event_id
      using errcode = 'no_data_found';
  end if;

  if auth.uid() is null or not private.is_event_organizer(p_event_id) then
    raise exception 'only the event organizer may declare a winner for event %', p_event_id
      using errcode = '42501';
  end if;

  if v_event.status is distinct from 'active' then
    raise exception 'event % is not active (status %)', p_event_id, v_event.status
      using errcode = 'check_violation';
  end if;

  select * into v_final_round
    from public.rounds
    where event_id = p_event_id and is_final_round
    for update;

  if not found then
    raise exception 'event % has no final round configured', p_event_id
      using errcode = 'check_violation';
  end if;

  if v_final_round.status is distinct from 'scoring_closed' then
    raise exception 'final round % cannot be declared from status % (must be scoring_closed)',
      v_final_round.id, v_final_round.status
      using errcode = 'check_violation';
  end if;

  select id into v_calc_id
    from public.result_calculations
    where event_id = p_event_id
      and round_id = v_final_round.id
      and segment_id is null
      and is_final;

  if v_calc_id is null then
    raise exception 'final round % has no final calculated results yet; run calculate_results first',
      v_final_round.id
      using errcode = 'check_violation';
  end if;

  select count(*), min(participant_id) into v_winner_count, v_winner_id
    from public.result_calculation_entries
    where calculation_id = v_calc_id and rank = 1;

  if v_winner_count = 0 then
    raise exception 'final round % has no ranked entries to declare a winner from', v_final_round.id
      using errcode = 'check_violation';
  end if;

  if v_winner_count > 1 then
    raise exception
      'final round % ends in a %-way tie at rank 1; resolve it (sudden-death tiebreak) before declaring a winner',
      v_final_round.id, v_winner_count
      using errcode = 'check_violation';
  end if;

  perform private.write_round_advancement_outcomes(v_final_round.id, v_calc_id, 1);

  update public.events
    set winner_participant_id = v_winner_id
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

comment on function public.declare_winner(uuid) is
  'Declares the event champion from the final round''s calculate_results entries: requires the final round scoring_closed with a final calculation and an untied rank 1, writes round_participants outcomes (the winner advanced, the rest eliminated), and sets events.winner_participant_id. Raises on a rank-1 tie rather than guessing (no co-champion representation yet — resolve via the sudden-death tiebreak, QA12). Does not conclude the event (T17). Organizer-only.';

revoke all on function public.declare_winner(uuid) from public;
grant execute on function public.declare_winner(uuid) to authenticated;

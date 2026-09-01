-- QA9 · Round-close (all-windows-closed) gate
--
-- Ships `close_round(p_round_id)` — the quiz analogue of the judged format's
-- completeness gate: "Round close: gated on all of the round's questions
-- being window_closed or voided (the quiz analogue of the judged
-- completeness gate). One-way." This is the transition the round's own
-- `scoring_open -> scoring_closed` status was reserved for back in QA1;
-- nothing has written it until now.
--
-- `close_round(p_round_id)` — organizer-only. Requires:
--   * the round belongs to an active event and is currently `scoring_open`
--   * every question across the round's segments is `window_closed` or
--     `voided` (a round with no questions at all vacuously satisfies this —
--     an organizer closing an empty round is a authoring mistake the RPC
--     doesn't need to second-guess).
-- On success: `status = scoring_closed`, `scoring_closed_at = now()`.
--
-- Not in scope here: adjudication (QA10), the answers immutability trigger
-- (QA11), calculate_results (T16).

create or replace function public.close_round(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round        public.rounds%rowtype;
  v_event_status public.event_status;
  v_open_count   integer;
begin
  select * into v_round from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'round % not found', p_round_id
      using errcode = 'no_data_found';
  end if;

  select status into v_event_status from public.events where id = v_round.event_id;

  if auth.uid() is null or not private.is_event_organizer(v_round.event_id) then
    raise exception 'only the event organizer may close round %', p_round_id
      using errcode = '42501';
  end if;

  if v_event_status is distinct from 'active' then
    raise exception 'round % belongs to an event that is not active (status %)',
      p_round_id, v_event_status
      using errcode = 'check_violation';
  end if;

  if v_round.status is distinct from 'scoring_open' then
    raise exception 'round % cannot be closed from status % (must be scoring_open)',
      p_round_id, v_round.status
      using errcode = 'check_violation';
  end if;

  select count(*) into v_open_count
    from public.questions q
    join public.segments s on s.id = q.segment_id
    where s.round_id = p_round_id
      and q.status not in ('window_closed', 'voided');

  if v_open_count > 0 then
    raise exception
      'round % cannot be closed: % question(s) are not yet window_closed or voided',
      p_round_id, v_open_count
      using errcode = 'check_violation';
  end if;

  update public.rounds
    set status = 'scoring_closed',
        scoring_closed_at = now()
    where id = p_round_id
    returning * into v_round;

  return v_round;
end;
$$;

comment on function public.close_round(uuid) is
  'Closes a round''s scoring (status = scoring_closed) once every question across its segments is window_closed or voided (an empty round vacuously qualifies) — the quiz analogue of the judged format''s per-round completeness gate. One-way. Organizer-only.';

revoke all on function public.close_round(uuid) from public;
grant execute on function public.close_round(uuid) to authenticated;

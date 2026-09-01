-- T17 · conclude_event RPC (terminal)
--
-- Ships the last lifecycle transition: active -> concluded. T6's
-- `enforce_event_status_transition` trigger already permits only
-- draft->active->concluded and nothing else (a one-way ratchet at the DB
-- level); this ticket adds the guarded RPC that performs the active->
-- concluded leg, mirroring `activate_event`'s shape (T6).
--
-- The gate is simple and shared across formats: an event may conclude once
-- it has a declared champion. `declare_winner` (T16a/QA12) is what sets
-- `events.winner_participant_id`, and it already enforces everything that
-- has to be true beforehand (final round scoring_closed, a final
-- calculate_results, and an untied — or tiebreak-resolved — rank 1), so
-- `conclude_event` doesn't need to re-derive any of that; it just checks the
-- one column declare_winner leaves behind and flips the status + timestamp.
-- No format branching is needed here (unlike `activate_event`): the gate is
-- `winner_participant_id is not null`, and in V1 only the quiz format can
-- ever reach `active` in the first place (judged activation still raises,
-- T6), so this is trivially format-agnostic without special-casing judged.
--
-- Not in scope here: anything about how the winner was determined (T16a,
-- QA12) or an Insomnia regression pass (T18).

create or replace function public.conclude_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event_id for update;

  if not found then
    raise exception 'event % not found', p_event_id
      using errcode = 'no_data_found';
  end if;

  if auth.uid() is null or v_event.organizer_id is distinct from auth.uid() then
    raise exception 'only the event organizer may conclude event %', p_event_id
      using errcode = '42501';
  end if;

  if v_event.status is distinct from 'active' then
    raise exception 'event % cannot be concluded from status % (must be active)',
      p_event_id, v_event.status
      using errcode = 'check_violation';
  end if;

  if v_event.winner_participant_id is null then
    raise exception
      'event % has no declared winner yet; call declare_winner before concluding',
      p_event_id
      using errcode = 'check_violation';
  end if;

  update public.events
    set status = 'concluded',
        concluded_at = now()
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

comment on function public.conclude_event(uuid) is
  'Moves an event active -> concluded (terminal, one-way — also enforced by T6''s events_status_transition_guard trigger): requires a declared winner (events.winner_participant_id set by declare_winner), then stamps status=concluded and concluded_at. Format-agnostic — the shared results engine already gated everything upstream of winner_participant_id. Organizer-only.';

revoke all on function public.conclude_event(uuid) from public;
grant execute on function public.conclude_event(uuid) to authenticated;

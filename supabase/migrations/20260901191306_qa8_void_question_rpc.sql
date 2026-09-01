-- QA8 · Void-question RPC
--
-- Ships the admin's escape valve for a bad question: "Before the round is
-- graded, the admin can void a bad question (wrong reveal, typo, no valid
-- answer); its answers are discarded and don't count. Voiding is one-way per
-- question but leaves an audit trail." The audit trail is QA1's existing
-- `voided_at`/`voided_by` columns; "discarded and don't count" is enforced by
-- deleting the question's answer rows outright (rather than leaving them for
-- every downstream reader — QA9's round-close gate, QA7's matcher, QA10's
-- adjudication, T16's calculate_results — to each re-derive a voided-question
-- exclusion).
--
-- `void_question(p_question_id)` — organizer-only. A question can be voided
-- from any pre-close status (`pending`, `window_open`, `window_closed`) as
-- long as:
--   * it isn't already voided (one-way), and
--   * its round hasn't closed yet (`scoring_open`) — "before the round is
--     graded" in the plan's lifecycle is adjudication, which only starts
--     after round-close (QA9), so gating on the round still being open is
--     strictly earlier and leaves no window to void an already-adjudicated
--     answer.
--
-- Not in scope here: round-close gate (QA9), adjudication (QA10), the
-- answers immutability trigger (QA11).

create or replace function public.void_question(p_question_id uuid)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question      public.questions%rowtype;
  v_event_id      uuid;
  v_round_status  public.round_status;
  v_event_status  public.event_status;
begin
  select * into v_question from public.questions where id = p_question_id for update;

  if not found then
    raise exception 'question % not found', p_question_id
      using errcode = 'no_data_found';
  end if;

  select e.id, r.status, e.status
    into v_event_id, v_round_status, v_event_status
    from public.segments s
    join public.rounds r on r.id = s.round_id
    join public.events e on e.id = r.event_id
    where s.id = v_question.segment_id;

  if auth.uid() is null or not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may void question %', p_question_id
      using errcode = '42501';
  end if;

  if v_question.status = 'voided' then
    raise exception 'question % has already been voided', p_question_id
      using errcode = 'check_violation';
  end if;

  if v_event_status is distinct from 'active' then
    raise exception 'question % belongs to an event that is not active (status %)',
      p_question_id, v_event_status
      using errcode = 'check_violation';
  end if;

  if v_round_status is distinct from 'scoring_open' then
    raise exception
      'question % cannot be voided: its round has already closed (status %)',
      p_question_id, v_round_status
      using errcode = 'check_violation';
  end if;

  delete from public.answers where question_id = p_question_id;

  update public.questions
    set status = 'voided',
        voided_at = now(),
        voided_by = auth.uid()
    where id = p_question_id
    returning * into v_question;

  return v_question;
end;
$$;

comment on function public.void_question(uuid) is
  'Voids a question before its round closes: marks it voided (voided_at/voided_by audit trail) and discards its existing answers outright so no downstream reader (matcher, adjudication, results) needs to re-derive a voided-question exclusion. One-way; rejects a question already voided or whose round has already closed. Organizer-only.';

revoke all on function public.void_question(uuid) from public;
grant execute on function public.void_question(uuid) to authenticated;

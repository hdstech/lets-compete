-- QA10 · Batched single-grader adjudication RPC
--
-- Ships the grader's write path: "a single authoritative grader reviews the
-- whole round's answers at once after the round closes ... confirming or
-- overriding each auto_correct into the final_correct." One RPC,
-- `adjudicate_round_answers(p_round_id, p_grades)`, takes the grader's whole
-- batch of decisions in one call rather than one round-trip per answer.
--
-- `p_grades` is a JSON array of `{"answer_id": uuid, "final_correct": bool}`
-- objects. For each entry whose `answer_id` belongs to `p_round_id`, writes
-- `final_correct`, `graded_by = auth.uid()`, `graded_at = now()`. Entries
-- naming an answer_id outside the round (or a stale/deleted one — e.g. a
-- voided question's answers, which QA8 deletes outright) simply update zero
-- rows rather than erroring, so a client sending a slightly stale snapshot
-- degrades gracefully instead of aborting the whole batch.
--
-- Grader-only (`events.grader_id`, QA2). Requires the round to already be
-- `scoring_closed` (QA9) — grading is explicitly not live. No JWT-claim
-- clearing here (unlike QA7's organizer-authored auto-mark write): the
-- caller genuinely *is* the grader, so QA2's `answers_column_guard` trigger
-- already permits this exact column set (final_correct/graded_by/graded_at/
-- updated_at) under its grader branch.
--
-- Not in scope here: the answers immutability trigger (QA11), which adds the
-- "locked once results are calculated" backstop on top of this RPC's own
-- round-status check; calculate_results (T16).

create or replace function public.adjudicate_round_answers(
  p_round_id uuid,
  p_grades   jsonb  -- array of {"answer_id": uuid, "final_correct": boolean}
)
returns setof public.answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.rounds%rowtype;
begin
  if auth.uid() is null then
    raise exception 'adjudicate_round_answers requires an authenticated grader'
      using errcode = '42501';
  end if;

  select * into v_round from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'round % not found', p_round_id
      using errcode = 'no_data_found';
  end if;

  if not private.is_event_grader(v_round.event_id) then
    raise exception 'only the event grader may adjudicate round %', p_round_id
      using errcode = '42501';
  end if;

  if v_round.status is distinct from 'scoring_closed' then
    raise exception 'round % cannot be adjudicated from status % (must be scoring_closed)',
      p_round_id, v_round.status
      using errcode = 'check_violation';
  end if;

  if p_grades is null or jsonb_typeof(p_grades) is distinct from 'array' then
    raise exception 'p_grades must be a JSON array of {answer_id, final_correct}'
      using errcode = 'invalid_parameter_value';
  end if;

  return query
    update public.answers a
      set final_correct = (g.value ->> 'final_correct')::boolean,
          graded_by     = auth.uid(),
          graded_at     = now(),
          updated_at    = now()
      from jsonb_array_elements(p_grades) as g(value)
      where a.round_id = p_round_id
        and a.id = (g.value ->> 'answer_id')::uuid
      returning a.*;
end;
$$;

comment on function public.adjudicate_round_answers(uuid, jsonb) is
  'Batched grader adjudication: given p_grades = [{"answer_id","final_correct"}, ...], writes final_correct (+ graded_by/graded_at) on each matching answer belonging to p_round_id. Entries naming an answer outside the round or already deleted (a voided question) update nothing rather than erroring. Requires the round to be scoring_closed. Grader-only (events.grader_id).';

revoke all on function public.adjudicate_round_answers(uuid, jsonb) from public;
grant execute on function public.adjudicate_round_answers(uuid, jsonb) to authenticated;

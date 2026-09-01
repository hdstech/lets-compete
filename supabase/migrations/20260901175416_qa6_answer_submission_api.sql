-- QA6 · Answer submission API (submit + draft/sendBeacon replay)
--
-- Ships the write path for live quiz answers: a single RPC, `submit_answer`,
-- that both a live in-window submit and a reconnect/sendBeacon draft replay
-- call. Direct table access (participant self-writes) is already governed by
-- QA2's answers RLS policies plus QA5's time-aware
-- `private.question_is_window_open`, but that predicate is a hard boundary
-- at exactly `window_seconds` — it cannot express the plan's disconnection
-- tolerance ("the server accepts a replayed draft iff it arrives within a
-- short grace window *and* token-elapsed <= the question window"). A
-- SECURITY DEFINER RPC is therefore the only way to honor a late-arriving-
-- but-in-grace submission without loosening the RLS boundary for everyone.
--
-- Acceptance requires ALL of:
--   * the caller is an approved participant of the question's event
--   * the question has been revealed and is not voided
--   * `p_reveal_token` matches the question's current reveal_token (guards
--     against a stale client answering against a since-replaced reveal —
--     reveal_token is reissued fresh by QA5's reveal_question)
--   * `p_client_elapsed_ms` (the client's own token-anchored timer, immune
--     to a rolled-back device clock) falls within [0, window_seconds*1000]
--   * the server's own clock is still within window_seconds + a short grace
--     period since revealed_at — the absolute backstop; grace can never be
--     stretched by a lying client
--
-- A submission that fails any of the above is rejected outright (raises; no
-- row is written) — the plan's "a no-show or unrecoverably-late answer
-- scores 0" falls out for free downstream (T16's calculate_results sums
-- final_correct across existing rows only; a missing row contributes 0).
--
-- A second call for the same (participant, question) upserts the existing
-- row — an in-window edit, or a later draft replay superseding an earlier
-- one — as long as it hasn't been graded yet.
--
-- The grace period is a fixed constant for now (10s is short relative to a
-- typical question window and covers a brief reconnect); promote it to a
-- per-event/question config column if a real test session ever needs to
-- tune it.
--
-- Not in scope here: auto pre-mark matching (QA7), void (QA8), round-close
-- gate (QA9), adjudication (QA10), the unbypassable answers immutability
-- trigger (QA11).

create or replace function public.submit_answer(
  p_question_id       uuid,
  p_submitted_text    text,
  p_client_elapsed_ms integer,
  p_reveal_token      text,
  p_is_saved_draft    boolean default false
)
returns public.answers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question       public.questions%rowtype;
  v_round_id       uuid;
  v_event_id       uuid;
  v_participant_id uuid;
  v_grace          constant interval := interval '10 seconds';
  v_window         interval;
  v_answer         public.answers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'submit_answer requires an authenticated participant'
      using errcode = '42501';
  end if;

  select * into v_question from public.questions where id = p_question_id for update;

  if not found then
    raise exception 'question % not found', p_question_id
      using errcode = 'no_data_found';
  end if;

  select r.id, r.event_id into v_round_id, v_event_id
    from public.segments s
    join public.rounds r on r.id = s.round_id
    where s.id = v_question.segment_id;

  select id into v_participant_id
    from public.participants
    where event_id = v_event_id
      and user_id = auth.uid()
      and admission_status = 'approved'
    for update;

  if not found then
    raise exception 'caller is not an approved participant of event %', v_event_id
      using errcode = '42501';
  end if;

  if v_question.revealed_at is null or v_question.status = 'pending' then
    raise exception 'question % has not been revealed yet', p_question_id
      using errcode = 'check_violation';
  end if;

  if v_question.status = 'voided' then
    raise exception 'question % has been voided', p_question_id
      using errcode = 'check_violation';
  end if;

  if v_question.reveal_token is null or p_reveal_token is distinct from v_question.reveal_token then
    raise exception 'reveal_token does not match question %''s current reveal', p_question_id
      using errcode = 'check_violation';
  end if;

  v_window := v_question.window_seconds * interval '1 second';

  if p_client_elapsed_ms is null
     or p_client_elapsed_ms < 0
     or p_client_elapsed_ms > v_question.window_seconds * 1000
  then
    raise exception
      'client_elapsed_ms % is outside question %''s % s answer window',
      p_client_elapsed_ms, p_question_id, v_question.window_seconds
      using errcode = 'check_violation';
  end if;

  if now() > v_question.revealed_at + v_window + v_grace then
    raise exception
      'question %''s answer window (plus grace) has closed; the submission is unrecoverably late',
      p_question_id
      using errcode = 'check_violation';
  end if;

  insert into public.answers (
    participant_id, question_id, round_id, segment_id,
    submitted_text, submitted_at, is_saved_draft, client_elapsed_ms
  ) values (
    v_participant_id, p_question_id, v_round_id, v_question.segment_id,
    p_submitted_text, now(), coalesce(p_is_saved_draft, false), p_client_elapsed_ms
  )
  on conflict (participant_id, question_id) do update
    set submitted_text    = excluded.submitted_text,
        submitted_at      = excluded.submitted_at,
        is_saved_draft    = excluded.is_saved_draft,
        client_elapsed_ms = excluded.client_elapsed_ms,
        updated_at        = now()
    where public.answers.final_correct is null
      and public.answers.auto_correct is null
  returning * into v_answer;

  if not found then
    raise exception
      'answer for participant % / question % has already been graded and cannot be resubmitted',
      v_participant_id, p_question_id
      using errcode = 'check_violation';
  end if;

  return v_answer;
end;
$$;

comment on function public.submit_answer(uuid, text, integer, text, boolean) is
  'Submits (or upserts) a participant''s answer to a revealed question — the single write path for both a live in-window submit and a reconnect/sendBeacon draft replay. Accepts iff the caller is an approved participant, the question is revealed and not voided, p_reveal_token matches the question''s current reveal, p_client_elapsed_ms falls within the window, and the server clock is still within window_seconds + a short grace period of revealed_at. SECURITY DEFINER because a grace-period replay must be accepted past QA5''s time-aware private.question_is_window_open, which bounds ordinary RLS writes exactly at window_seconds with no grace.';

revoke all on function public.submit_answer(uuid, text, integer, text, boolean) from public;
grant execute on function public.submit_answer(uuid, text, integer, text, boolean) to authenticated;

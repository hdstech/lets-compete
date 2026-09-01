-- QA12 · Sudden-death tiebreak sub-flow
--
-- T16a shipped advance_round/declare_winner but explicitly deferred "the
-- sudden-death tiebreak sub-flow that resolves a rank-1 tie" (and, per the
-- plan, an advancement-cutoff tie an admin wants narrowed to an exact N
-- rather than letting RANK()'s own gap semantics co-advance everyone tied)
-- to this ticket: "Only the tied participants (at an advancement cutoff or
-- rank-1) enter a tiebreak sub-flow: one tiebreak question at a time, same
-- live-timed hybrid-graded mechanics, repeated until the tie breaks.
-- Tiebreak questions come from a pre-authored reserve pool defined in draft.
-- If the pool is exhausted, fall back to the standard co-advance /
-- co-champion rule."
--
-- Four new tables track a sudden-death instance:
--   * `tiebreaks`          — one row per attempt to break a tie on a round
--     (`scope` = 'advance' for a non-final round's cutoff, 'winner' for the
--     final round's rank-1; `cutoff_rank` + `slots_to_fill` freeze exactly
--     how many of the tied cohort must end up "advanced"). At most one
--     `open` tiebreak per round (partial unique index).
--   * `tiebreak_entrants`  — the tied cohort, frozen at `start_tiebreak`,
--     with an `outcome` ('pending' until resolved).
--   * `tiebreak_questions` — the draw history: which reserve question was
--     pulled, in what order, and whether it produced a clean cut
--     (`broke_tie`).
--
-- Key design decisions:
--
--   1. **Reserve pool lives in the round's own segments.** QA4 already
--      authors `is_tiebreak = true` questions alongside normal ones,
--      "authored in draft, but only revealed during a later sudden-death
--      sub-flow" — so the pool for round X's tiebreak is exactly that
--      round's `is_tiebreak` questions with `status = 'pending'`.
--
--   2. **Reusing the live mechanics, minus the round-status gate.**
--      `submit_answer` (QA6), `close_question_window` (QA5), and
--      `adjudicate_round_answers` (QA10) all gate on the *question's* own
--      status/timing, never on `rounds.status` — so they work unmodified
--      once a tiebreak question is revealed, even though the round is
--      already `scoring_closed` (tiebreak necessarily starts after
--      calculate_results has already shown the tie). Only `reveal_question`
--      requires `rounds.status = 'scoring_open'`, so `draw_tiebreak_question`
--      below ships its own draw+reveal step (organizer draws blind — the
--      "sudden death" surprise — and the question opens immediately; no
--      separate queued-but-unrevealed state).
--
--   3. **Tiebreak points never enter the round's own scoreboard.**
--      `private.result_scope_totals` (T16) is redefined to exclude
--      `is_tiebreak` questions from every scope's sum. Sudden death is a
--      resolution mechanism, not additional scoring — it decides bracket
--      placement without perturbing the round's recorded leaderboard, and
--      (more importantly) avoids a tiebreak point letting an entrant
--      leapfrog an unrelated, already-decided higher rank. A tiebreak's own
--      cumulative score is computed separately by `resolve_tiebreak_question`
--      straight from `answers` joined through `tiebreak_questions`.
--
--   4. **Immutability trigger carve-out for graders.** QA11's grader-write
--      branch locks `final_correct` once the round has a final
--      `result_calculations` row — which, for a tiebreak, is already true by
--      construction (that's how the tie was found). `is_tiebreak` questions
--      are exempted from that specific lock; their content-write path
--      (participant submit) is untouched since it never checked calculation
--      state to begin with.
--
--   5. **Write access is restricted to the frozen cohort**, in both
--      `submit_answer` (the RPC participants actually call) and the
--      `answers` RLS insert/update policies (the direct-table-write path
--      QA6's own comment says coexists with the RPC) — everyone else can
--      still *see* the question (spectator visibility, unchanged) but only
--      a `tiebreak_entrants` row lets you answer it.
--
--   6. **No re-narrowing of the cohort between draws.** Every entrant keeps
--      answering every drawn question, and resolution compares each
--      entrant's *cumulative* sudden-death score. This is simpler than
--      shrinking the cohort each round and still fully correct: comparing
--      the value at the `slots_to_fill` cutoff against the value just below
--      it is unaffected by ties elsewhere in the cohort (already-clear
--      advancers or eliminees don't move the boundary). The only cost is
--      participants who are mathematically already out keep answering
--      alongside the group still genuinely contesting the boundary.
--
--   7. **Exhaustion**: `draw_tiebreak_question` returns null (not an
--      exception — flipping the tiebreak to `exhausted` must survive the
--      call) once the pool is empty. `advance_round` needs no code change
--      for this: with no `resolved` tiebreak on record it already falls
--      back to RANK()'s own co-advance. `declare_winner` still raises on an
--      unresolved rank-1 tie — V1's `events.winner_participant_id` is a
--      single slot with no co-champion representation, a gap the plan flags
--      and this ticket does not attempt to invent a schema for; the
--      exhausted case gets a clearer message than the generic "resolve it"
--      one.
--
--   8. **Staleness guard**: `tiebreaks.calculation_id` freezes which
--      calculation the tie was read from. `write_round_advancement_outcomes`
--      and `declare_winner` only honor a `resolved` tiebreak whose
--      `calculation_id` matches the calculation currently being acted on —
--      a recalculation after the tiebreak resolved makes it stale and the
--      standard rule applies again instead of silently reusing a decision
--      about a different score snapshot.
--
--   9. **close_round must ignore the reserve pool.** QA9's `close_round`
--      gate requires every question in the round to be `window_closed` or
--      `voided` — but a reserve question is deliberately authored `pending`
--      and stays that way unless a tiebreak later draws it (QA4's own
--      comment already anticipated this). Without excluding `is_tiebreak`
--      questions, a round with any authored reserve pool could never close
--      at all. Fixed here since QA12 is what first gives those rows a real
--      lifecycle.
--
-- Not in scope here: co-champion representation (see #7), UI (QB2/QB7).

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.tiebreak_scope           as enum ('advance', 'winner');
create type public.tiebreak_status          as enum ('open', 'resolved', 'exhausted');
create type public.tiebreak_entrant_outcome as enum ('pending', 'advanced', 'eliminated');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table public.tiebreaks (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.rounds (id) on delete cascade,
  scope          public.tiebreak_scope not null,
  cutoff_rank    integer not null,
  calculation_id uuid not null references public.result_calculations (id),
  slots_to_fill  integer not null,
  status         public.tiebreak_status not null default 'open',
  resolved_at    timestamptz,
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now(),
  constraint tiebreaks_slots_to_fill_positive check (slots_to_fill > 0)
);

comment on table public.tiebreaks is
  'One sudden-death attempt at breaking a tie on a round: scope=advance for a non-final round''s advancement cutoff, scope=winner for the final round''s rank-1. slots_to_fill = cutoff_rank minus however many entries already rank strictly better, i.e. how many of the tied cohort must end up advanced.';

create unique index tiebreaks_one_open_per_round on public.tiebreaks (round_id) where status = 'open';
create index tiebreaks_round_id_idx on public.tiebreaks (round_id);
create index tiebreaks_calculation_id_idx on public.tiebreaks (calculation_id);

create table public.tiebreak_entrants (
  tiebreak_id    uuid not null references public.tiebreaks (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  outcome        public.tiebreak_entrant_outcome not null default 'pending',
  primary key (tiebreak_id, participant_id)
);

comment on table public.tiebreak_entrants is
  'The tied cohort, frozen when its tiebreak starts. outcome flips from pending to advanced/eliminated once resolve_tiebreak_question finds a clean cut.';

create index tiebreak_entrants_participant_id_idx on public.tiebreak_entrants (participant_id);

create table public.tiebreak_questions (
  id          uuid primary key default gen_random_uuid(),
  tiebreak_id uuid not null references public.tiebreaks (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  sequence    integer not null,
  drawn_at    timestamptz not null default now(),
  resolved_at timestamptz,
  broke_tie   boolean,  -- null = voided or not yet evaluated; true = clean cut; false = still tied, draw again
  unique (tiebreak_id, question_id),
  unique (tiebreak_id, sequence)
);

comment on table public.tiebreak_questions is
  'Draw history for a tiebreak: one row per reserve question pulled, in order. At most one row per tiebreak has resolved_at null at a time ("one at a time").';

create index tiebreak_questions_tiebreak_id_idx on public.tiebreak_questions (tiebreak_id);
create index tiebreak_questions_question_id_idx on public.tiebreak_questions (question_id);

-- ---------------------------------------------------------------------------
-- 3. RLS — select-only for members; every write flows through the
--    SECURITY DEFINER RPCs below (same model as reveal/void/advance).
-- ---------------------------------------------------------------------------
alter table public.tiebreaks         enable row level security;
alter table public.tiebreak_entrants enable row level security;
alter table public.tiebreak_questions enable row level security;

revoke all on table public.tiebreaks          from anon, authenticated;
revoke all on table public.tiebreak_entrants  from anon, authenticated;
revoke all on table public.tiebreak_questions from anon, authenticated;

grant select on table public.tiebreaks          to authenticated;
grant select on table public.tiebreak_entrants  to authenticated;
grant select on table public.tiebreak_questions to authenticated;

create or replace function private.event_id_from_tiebreak(p_tiebreak_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.event_id
  from public.tiebreaks t
  join public.rounds r on r.id = t.round_id
  where t.id = p_tiebreak_id
$$;

grant execute on function private.event_id_from_tiebreak(uuid) to authenticated;

create policy tiebreaks_select_member
  on public.tiebreaks for select to authenticated
  using (private.can_read_event(private.event_id_from_round(round_id)));

create policy tiebreak_entrants_select_member
  on public.tiebreak_entrants for select to authenticated
  using (private.can_read_event(private.event_id_from_tiebreak(tiebreak_id)));

create policy tiebreak_questions_select_member
  on public.tiebreak_questions for select to authenticated
  using (private.can_read_event(private.event_id_from_tiebreak(tiebreak_id)));

-- ---------------------------------------------------------------------------
-- 4. private.result_scope_totals (T16) — exclude tiebreak questions from
--    every scope's scored total (decision #3 above).
-- ---------------------------------------------------------------------------
create or replace function private.result_scope_totals(
  p_event_id         uuid,
  p_target_round_id  uuid,
  p_segment_id       uuid
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
   and not exists (
     select 1 from public.questions q where q.id = a.question_id and q.is_tiebreak
   )
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
  'Per-participant sum(final_correct) for p_target_round_id (optionally narrowed to one segment), restricted to eligible+approved participants active in that round, and EXCLUDING is_tiebreak questions (QA12: sudden-death points resolve bracket placement, they never inflate the round''s own scoreboard). A round with zero round_participants rows (never seeded, e.g. round 1) is treated as every eligible/approved participant being active; a seeded round (T16a onward) is authoritative via its explicit active rows.';

-- ---------------------------------------------------------------------------
-- 5. private.enforce_answers_immutability (QA11) — carve-out: a tiebreak
--    question's grader write is never locked by the round's pre-existing
--    final calculation (decision #4 above).
-- ---------------------------------------------------------------------------
create or replace function private.enforce_answers_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question        public.questions%rowtype;
  v_grace  constant interval := interval '10 seconds';  -- must match QA6/QA7's grace window
  v_is_grader_write boolean;
  v_calculated      boolean;
begin
  -- service_role / QA7's claim-cleared system write: skip (matches
  -- answers_column_guard's own "uid is null" bypass).
  if auth.uid() is null then
    return new;
  end if;

  select * into v_question from public.questions where id = new.question_id;

  if not found then
    raise exception 'question % not found', new.question_id
      using errcode = 'no_data_found';
  end if;

  if v_question.status = 'voided' then
    raise exception 'question % has been voided; it no longer accepts answers', new.question_id
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    v_is_grader_write := (
      new.participant_id       is not distinct from old.participant_id
      and new.question_id      is not distinct from old.question_id
      and new.round_id         is not distinct from old.round_id
      and new.segment_id       is not distinct from old.segment_id
      and new.submitted_text   is not distinct from old.submitted_text
      and new.submitted_at     is not distinct from old.submitted_at
      and new.is_saved_draft   is not distinct from old.is_saved_draft
      and new.client_elapsed_ms is not distinct from old.client_elapsed_ms
      and new.auto_correct     is not distinct from old.auto_correct
      and new.final_correct    is distinct from old.final_correct
    );
  else
    v_is_grader_write := false;
  end if;

  if v_is_grader_write then
    -- QA12: a tiebreak question is graded *after* the round's own final
    -- calculation already exists (that calculation is how the tie was
    -- found) — exempt it from the "already calculated" lock rather than
    -- making sudden-death ungradable by construction.
    if not v_question.is_tiebreak then
      select exists (
        select 1
        from public.result_calculations rc
        where rc.round_id = new.round_id
          and rc.segment_id is null
          and rc.is_final
      ) into v_calculated;

      if v_calculated then
        raise exception
          'answers for round % are locked: results have already been calculated',
          new.round_id
          using errcode = 'check_violation';
      end if;
    end if;

    return new;
  end if;

  -- Content write (submit / reconnect / sendBeacon replay): must still be
  -- within the question's window + grace, with a plausible elapsed time.
  if v_question.revealed_at is null
     or now() > v_question.revealed_at + (v_question.window_seconds * interval '1 second') + v_grace
  then
    raise exception
      'answers for question % are locked: its answer window (plus grace) has closed',
      new.question_id
      using errcode = 'check_violation';
  end if;

  if new.client_elapsed_ms is null or new.client_elapsed_ms > v_question.window_seconds * 1000 then
    raise exception
      'answer for question % reports elapsed time outside its % s answer window',
      new.question_id, v_question.window_seconds
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function private.enforce_answers_immutability() is
  'BEFORE INSERT/UPDATE trigger fn for public.answers: the unbypassable backstop behind QA6 (submit)/QA10 (grade) — a content write must still be within its question''s window+grace with a plausible client_elapsed_ms; a grader write (only final_correct differs) is allowed unless the round already has a final result_calculations row, UNLESS the question is_tiebreak (QA12: sudden-death is graded after that calculation already exists by design); a voided question accepts nothing. Skipped when auth.uid() is null (service-role / QA7''s claim-cleared auto-mark write).';

-- ---------------------------------------------------------------------------
-- 6. Entrant-only write access (decision #5) — helper + RLS + submit_answer.
-- ---------------------------------------------------------------------------
create or replace function private.is_tiebreak_entrant(p_question_id uuid, p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tiebreak_questions tq
    join public.tiebreak_entrants te on te.tiebreak_id = tq.tiebreak_id
    where tq.question_id = p_question_id
      and te.participant_id = p_participant_id
  )
$$;

grant execute on function private.is_tiebreak_entrant(uuid, uuid) to authenticated;

create or replace function private.can_submit_tiebreak_question(p_question_id uuid, p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (select 1 from public.questions q where q.id = p_question_id and q.is_tiebreak)
    or private.is_tiebreak_entrant(p_question_id, p_participant_id)
$$;

comment on function private.can_submit_tiebreak_question(uuid, uuid) is
  'True for every non-tiebreak question (unrestricted, existing behavior); for an is_tiebreak question, true only if p_participant_id is an entrant of the tiebreak that drew it. Everyone can still SEE a revealed tiebreak question (spectator visibility, unchanged); this gates who may answer it.';

grant execute on function private.can_submit_tiebreak_question(uuid, uuid) to authenticated;

drop policy if exists answers_insert_own_open on public.answers;
create policy answers_insert_own_open
  on public.answers for insert to authenticated
  with check (
    private.owns_participant(participant_id)
    and private.question_is_window_open(question_id)
    and private.can_submit_tiebreak_question(question_id, participant_id)
    and final_correct is null
    and graded_by is null
    and graded_at is null
    and auto_correct is null
  );

drop policy if exists answers_update on public.answers;
create policy answers_update
  on public.answers for update to authenticated
  using (
    private.is_event_grader(private.event_id_from_round(round_id))
    or (
      private.owns_participant(participant_id)
      and private.question_is_window_open(question_id)
    )
  )
  with check (
    private.is_event_grader(private.event_id_from_round(round_id))
    or (
      private.owns_participant(participant_id)
      and private.question_is_window_open(question_id)
      and private.can_submit_tiebreak_question(question_id, participant_id)
      and final_correct is null
      and graded_by is null
      and graded_at is null
      and auto_correct is null
    )
  );

-- submit_answer (QA6) is the RPC participants actually call, and it's
-- SECURITY DEFINER — it bypasses the RLS policies above entirely, so the
-- entrant check must also live here or a non-entrant could still answer a
-- tiebreak question through the normal submission path.
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

  if v_question.is_tiebreak and not private.is_tiebreak_entrant(p_question_id, v_participant_id) then
    raise exception 'participant % is not part of the tiebreak that drew question %',
      v_participant_id, p_question_id
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
  'Submits (or upserts) a participant''s answer to a revealed question — the single write path for both a live in-window submit and a reconnect/sendBeacon draft replay. Accepts iff the caller is an approved participant (and, for an is_tiebreak question, an entrant of the tiebreak that drew it — QA12), the question is revealed and not voided, p_reveal_token matches the question''s current reveal, p_client_elapsed_ms falls within the window, and the server clock is still within window_seconds + a short grace period of revealed_at. SECURITY DEFINER because a grace-period replay must be accepted past QA5''s time-aware private.question_is_window_open, which bounds ordinary RLS writes exactly at window_seconds with no grace.';

revoke all on function public.submit_answer(uuid, text, integer, text, boolean) from public;
grant execute on function public.submit_answer(uuid, text, integer, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. close_round (QA9) — exclude the is_tiebreak reserve pool from the
--    all-questions-closed gate (decision #9 above)
-- ---------------------------------------------------------------------------
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
      and not q.is_tiebreak
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
  'Closes a round''s scoring (status = scoring_closed) once every non-reserve question across its segments is window_closed or voided (an empty round vacuously qualifies) — the quiz analogue of the judged format''s per-round completeness gate. is_tiebreak reserve-pool questions are excluded from this check (QA12): they are deliberately authored pending and stay that way unless a later sudden-death sub-flow draws them. One-way. Organizer-only.';

revoke all on function public.close_round(uuid) from public;
grant execute on function public.close_round(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. start_tiebreak — freeze the tied cohort and open a sudden-death instance
-- ---------------------------------------------------------------------------
create or replace function public.start_tiebreak(p_round_id uuid)
returns public.tiebreaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round        public.rounds%rowtype;
  v_event_status public.event_status;
  v_scope        public.tiebreak_scope;
  v_cutoff       integer;
  v_calc_id      uuid;
  v_tied_count   integer;
  v_above_count  integer;
  v_slots        integer;
  v_tiebreak     public.tiebreaks%rowtype;
begin
  select * into v_round from public.rounds where id = p_round_id for update;

  if not found then
    raise exception 'round % not found', p_round_id
      using errcode = 'no_data_found';
  end if;

  select status into v_event_status from public.events where id = v_round.event_id;

  if auth.uid() is null or not private.is_event_organizer(v_round.event_id) then
    raise exception 'only the event organizer may start a tiebreak for round %', p_round_id
      using errcode = '42501';
  end if;

  if v_event_status is distinct from 'active' then
    raise exception 'round % belongs to an event that is not active (status %)',
      p_round_id, v_event_status
      using errcode = 'check_violation';
  end if;

  if v_round.status is distinct from 'scoring_closed' then
    raise exception
      'round % cannot start a tiebreak from status % (must be scoring_closed, before advance_round/declare_winner)',
      p_round_id, v_round.status
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.tiebreaks where round_id = p_round_id and status = 'open') then
    raise exception 'round % already has an open tiebreak; resolve or exhaust it first', p_round_id
      using errcode = 'check_violation';
  end if;

  if v_round.is_final_round then
    v_scope  := 'winner';
    v_cutoff := 1;
  else
    v_scope  := 'advance';
    v_cutoff := v_round.advancement_n;
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

  select count(*) into v_tied_count
    from public.result_calculation_entries
    where calculation_id = v_calc_id and rank = v_cutoff;

  if v_tied_count < 2 then
    raise exception 'round % has no tie at rank % to break', p_round_id, v_cutoff
      using errcode = 'check_violation';
  end if;

  select count(*) into v_above_count
    from public.result_calculation_entries
    where calculation_id = v_calc_id and rank < v_cutoff;

  v_slots := v_cutoff - v_above_count;

  if v_slots <= 0 or v_slots >= v_tied_count then
    raise exception
      'round %''s tie at rank % (% participants, % slot(s) to fill) is not a resolvable tiebreak boundary',
      p_round_id, v_cutoff, v_tied_count, v_slots
      using errcode = 'check_violation';
  end if;

  insert into public.tiebreaks (round_id, scope, cutoff_rank, calculation_id, slots_to_fill, created_by)
    values (p_round_id, v_scope, v_cutoff, v_calc_id, v_slots, auth.uid())
    returning * into v_tiebreak;

  insert into public.tiebreak_entrants (tiebreak_id, participant_id)
    select v_tiebreak.id, participant_id
    from public.result_calculation_entries
    where calculation_id = v_calc_id and rank = v_cutoff;

  return v_tiebreak;
end;
$$;

comment on function public.start_tiebreak(uuid) is
  'Opens a sudden-death tiebreak for round p_round_id: scope/cutoff are inferred from is_final_round (winner/rank-1, or advance/advancement_n), read from that round''s own final calculate_results output. Requires the round scoring_closed with no other tiebreak already open, and a genuine tie straddling the cutoff (>=2 entries at rank = cutoff, with 1..tied_count-1 slots to fill above it). Freezes the tied cohort into tiebreak_entrants. Organizer-only.';

revoke all on function public.start_tiebreak(uuid) from public;
grant execute on function public.start_tiebreak(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. draw_tiebreak_question — draw the next reserve question and reveal it
--    in one step (decision #2/#7 above)
-- ---------------------------------------------------------------------------
create or replace function public.draw_tiebreak_question(p_tiebreak_id uuid)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tiebreak public.tiebreaks%rowtype;
  v_event_id uuid;
  v_question public.questions%rowtype;
  v_next_seq integer;
begin
  select * into v_tiebreak from public.tiebreaks where id = p_tiebreak_id for update;

  if not found then
    raise exception 'tiebreak % not found', p_tiebreak_id
      using errcode = 'no_data_found';
  end if;

  select event_id into v_event_id from public.rounds where id = v_tiebreak.round_id;

  if auth.uid() is null or not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may draw a tiebreak question for %', p_tiebreak_id
      using errcode = '42501';
  end if;

  if v_tiebreak.status is distinct from 'open' then
    raise exception 'tiebreak % is not open (status %)', p_tiebreak_id, v_tiebreak.status
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.tiebreak_questions
    where tiebreak_id = p_tiebreak_id and resolved_at is null
  ) then
    raise exception
      'tiebreak %''s current question has not been resolved yet; call resolve_tiebreak_question first',
      p_tiebreak_id
      using errcode = 'check_violation';
  end if;

  select q.* into v_question
    from public.questions q
    join public.segments s on s.id = q.segment_id
    where s.round_id = v_tiebreak.round_id
      and q.is_tiebreak
      and q.status = 'pending'
      and q.id not in (
        select question_id from public.tiebreak_questions where tiebreak_id = p_tiebreak_id
      )
    order by s.sequence, q.sequence
    limit 1
    for update;

  if not found then
    -- Pool exhausted: flip the tiebreak so the fallback rule applies, and
    -- return null (not an exception, which would roll this update back).
    update public.tiebreaks set status = 'exhausted' where id = p_tiebreak_id;
    return null;
  end if;

  select coalesce(max(sequence), 0) + 1 into v_next_seq
    from public.tiebreak_questions where tiebreak_id = p_tiebreak_id;

  update public.questions
    set status = 'window_open',
        revealed_at = now(),
        reveal_token = gen_random_uuid()::text
    where id = v_question.id
    returning * into v_question;

  insert into public.tiebreak_questions (tiebreak_id, question_id, sequence)
    values (p_tiebreak_id, v_question.id, v_next_seq);

  return v_question;
end;
$$;

comment on function public.draw_tiebreak_question(uuid) is
  'Draws the next unused is_tiebreak reserve question from the tiebreak''s round (ordered by segment/question sequence, i.e. authoring order) and immediately reveals it (status=window_open, fresh reveal_token) — combining draw+reveal into one action, since the pool is a blind draw by design. Requires the tiebreak open with its previous drawn question already resolved ("one at a time"). Returns null (after flipping the tiebreak to exhausted) once the pool is empty — a real, expected outcome to check for, not an error. Organizer-only.';

revoke all on function public.draw_tiebreak_question(uuid) from public;
grant execute on function public.draw_tiebreak_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. void_tiebreak_question — QA8's escape valve, adapted for a
--    scoring_closed round (its round-status gate doesn't apply here)
-- ---------------------------------------------------------------------------
create or replace function public.void_tiebreak_question(p_tiebreak_id uuid)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tiebreak     public.tiebreaks%rowtype;
  v_event_id     uuid;
  v_tq           public.tiebreak_questions%rowtype;
  v_question     public.questions%rowtype;
  v_graded_count integer;
begin
  select * into v_tiebreak from public.tiebreaks where id = p_tiebreak_id for update;

  if not found then
    raise exception 'tiebreak % not found', p_tiebreak_id
      using errcode = 'no_data_found';
  end if;

  select event_id into v_event_id from public.rounds where id = v_tiebreak.round_id;

  if auth.uid() is null or not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may void a tiebreak question for %', p_tiebreak_id
      using errcode = '42501';
  end if;

  if v_tiebreak.status is distinct from 'open' then
    raise exception 'tiebreak % is not open (status %)', p_tiebreak_id, v_tiebreak.status
      using errcode = 'check_violation';
  end if;

  select * into v_tq
    from public.tiebreak_questions
    where tiebreak_id = p_tiebreak_id and resolved_at is null
    for update;

  if not found then
    raise exception 'tiebreak % has no currently drawn question to void', p_tiebreak_id
      using errcode = 'check_violation';
  end if;

  select * into v_question from public.questions where id = v_tq.question_id for update;

  select count(*) into v_graded_count
    from public.answers
    where question_id = v_question.id and final_correct is not null;

  if v_graded_count > 0 then
    raise exception 'tiebreak question % has already been graded; it cannot be voided', v_question.id
      using errcode = 'check_violation';
  end if;

  delete from public.answers where question_id = v_question.id;

  update public.questions
    set status = 'voided',
        voided_at = now(),
        voided_by = auth.uid()
    where id = v_question.id
    returning * into v_question;

  -- Consumes the "one at a time" slot without a tie decision, freeing the
  -- next draw_tiebreak_question call; it does not count toward broke_tie.
  update public.tiebreak_questions
    set resolved_at = now(), broke_tie = null
    where id = v_tq.id;

  return v_question;
end;
$$;

comment on function public.void_tiebreak_question(uuid) is
  'Voids the tiebreak''s currently drawn question (discards its answers, marks it voided) as long as none of its answers have been graded yet, and frees the tiebreak to draw its next question. QA8''s void_question requires rounds.status = scoring_open, which a tiebreak''s round never is; this is the equivalent escape valve for a tiebreak question instead. Organizer-only.';

revoke all on function public.void_tiebreak_question(uuid) from public;
grant execute on function public.void_tiebreak_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. resolve_tiebreak_question — grade-complete check, cumulative score,
--     clean-cut detection (decision #6 above)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_tiebreak_question(p_tiebreak_id uuid)
returns public.tiebreaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tiebreak        public.tiebreaks%rowtype;
  v_event_id        uuid;
  v_tq              public.tiebreak_questions%rowtype;
  v_question        public.questions%rowtype;
  v_ungraded        integer;
  v_score_at_cut    integer;
  v_score_after_cut integer;
  v_clean_cut       boolean;
begin
  select * into v_tiebreak from public.tiebreaks where id = p_tiebreak_id for update;

  if not found then
    raise exception 'tiebreak % not found', p_tiebreak_id
      using errcode = 'no_data_found';
  end if;

  select event_id into v_event_id from public.rounds where id = v_tiebreak.round_id;

  if auth.uid() is null or not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may resolve tiebreak %', p_tiebreak_id
      using errcode = '42501';
  end if;

  if v_tiebreak.status is distinct from 'open' then
    raise exception 'tiebreak % is not open (status %)', p_tiebreak_id, v_tiebreak.status
      using errcode = 'check_violation';
  end if;

  select * into v_tq
    from public.tiebreak_questions
    where tiebreak_id = p_tiebreak_id and resolved_at is null
    for update;

  if not found then
    raise exception
      'tiebreak % has no currently drawn question to resolve; call draw_tiebreak_question first',
      p_tiebreak_id
      using errcode = 'check_violation';
  end if;

  select * into v_question from public.questions where id = v_tq.question_id;

  if v_question.status not in ('window_closed', 'voided') then
    raise exception 'tiebreak question %''s answer window is still open (status %)',
      v_question.id, v_question.status
      using errcode = 'check_violation';
  end if;

  select count(*) into v_ungraded
    from public.answers
    where question_id = v_question.id and final_correct is null;

  if v_ungraded > 0 then
    raise exception
      'tiebreak question % has % ungraded answer(s); call adjudicate_round_answers before resolving',
      v_question.id, v_ungraded
      using errcode = 'check_violation';
  end if;

  -- Cumulative sudden-death score per entrant across every tiebreak question
  -- drawn so far (not just this one), so a multi-question sudden death
  -- accumulates instead of resetting on each draw. The cut is checked at the
  -- VALUE straddling slots_to_fill, which is robust to how ties elsewhere in
  -- the cohort happen to sort (see decision #6).
  with totals as (
    select te.participant_id,
           coalesce(sum((a.final_correct)::int), 0)::integer as total
    from public.tiebreak_entrants te
    left join public.tiebreak_questions tq on tq.tiebreak_id = p_tiebreak_id
    left join public.answers a
      on a.question_id = tq.question_id and a.participant_id = te.participant_id
    where te.tiebreak_id = p_tiebreak_id
    group by te.participant_id
  )
  select
    (select total from totals order by total desc offset (v_tiebreak.slots_to_fill - 1) limit 1),
    (select total from totals order by total desc offset (v_tiebreak.slots_to_fill) limit 1)
  into v_score_at_cut, v_score_after_cut;

  v_clean_cut := v_score_at_cut is distinct from v_score_after_cut;

  update public.tiebreak_questions
    set resolved_at = now(), broke_tie = v_clean_cut
    where id = v_tq.id;

  if not v_clean_cut then
    return v_tiebreak;
  end if;

  with totals as (
    select te.participant_id,
           coalesce(sum((a.final_correct)::int), 0)::integer as total
    from public.tiebreak_entrants te
    left join public.tiebreak_questions tq on tq.tiebreak_id = p_tiebreak_id
    left join public.answers a
      on a.question_id = tq.question_id and a.participant_id = te.participant_id
    where te.tiebreak_id = p_tiebreak_id
    group by te.participant_id
  )
  update public.tiebreak_entrants te
    set outcome = (case when t.total > v_score_after_cut then 'advanced' else 'eliminated' end)::public.tiebreak_entrant_outcome
    from totals t
    where te.tiebreak_id = p_tiebreak_id and te.participant_id = t.participant_id;

  update public.tiebreaks
    set status = 'resolved', resolved_at = now()
    where id = p_tiebreak_id
    returning * into v_tiebreak;

  return v_tiebreak;
end;
$$;

comment on function public.resolve_tiebreak_question(uuid) is
  'Evaluates the tiebreak''s currently drawn question once it is window_closed/voided and fully graded: computes each entrant''s cumulative sudden-death score across every question drawn so far, and checks for a clean cut at slots_to_fill. No cut: marks the question resolved (broke_tie=false) and returns the still-open tiebreak, ready for another draw_tiebreak_question. Clean cut: marks entrant outcomes (advanced/eliminated) and flips the tiebreak to resolved. Organizer-only.';

revoke all on function public.resolve_tiebreak_question(uuid) from public;
grant execute on function public.resolve_tiebreak_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. private.write_round_advancement_outcomes (T16a) — honor a resolved,
--     non-stale tiebreak for the boundary rank instead of always co-advancing
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
declare
  v_tiebreak_id uuid;
begin
  select id into v_tiebreak_id
    from public.tiebreaks
    where round_id = p_round_id
      and calculation_id = p_calculation_id
      and status = 'resolved'
    order by created_at desc
    limit 1;

  insert into public.round_participants (round_id, participant_id, status, advanced_by_calculation_id, updated_at)
    select
      p_round_id,
      e.participant_id,
      case
        when v_tiebreak_id is not null and e.rank = p_cutoff_rank
          then (case te.outcome when 'advanced' then 'advanced' else 'eliminated' end)::public.round_participant_status
        when e.rank <= p_cutoff_rank then 'advanced'
        else 'eliminated'
      end,
      p_calculation_id,
      now()
    from public.result_calculation_entries e
    left join public.tiebreak_entrants te
      on te.tiebreak_id = v_tiebreak_id and te.participant_id = e.participant_id
    where e.calculation_id = p_calculation_id
  on conflict (round_id, participant_id) do update
    set status                     = excluded.status,
        advanced_by_calculation_id = excluded.advanced_by_calculation_id,
        updated_at                 = now();
end;
$$;

comment on function private.write_round_advancement_outcomes(uuid, uuid, integer) is
  'Upserts round_participants for every participant in a calculation''s frozen entries: rank < p_cutoff_rank always advances, rank > p_cutoff_rank always eliminates. At rank = p_cutoff_rank (the boundary, where a tie lives): if a resolved QA12 tiebreak exists for this exact (round, calculation) — i.e. not stale — its per-entrant outcome decides advanced/eliminated; otherwise ties at the boundary co-advance (RANK()''s own gap semantics expand the field, the standard fallback when no tiebreak was run or its pool was exhausted). Shared by advance_round (cutoff = advancement_n) and declare_winner (cutoff = 1).';

-- ---------------------------------------------------------------------------
-- 13. declare_winner (T16a) — consult a resolved tiebreak before raising on
--     a rank-1 tie; keep raising (with a clearer message) when unresolved
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
  v_tiebreak_id  uuid;
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

  -- (array_agg(...))[1] rather than min(participant_id): uuid has no min()
  -- aggregate in stock Postgres. Order is irrelevant here since this branch
  -- only matters when there's exactly one rank-1 row (a tie is resolved via
  -- the tiebreak lookup below, not by picking an array element).
  select count(*), (array_agg(participant_id))[1] into v_winner_count, v_winner_id
    from public.result_calculation_entries
    where calculation_id = v_calc_id and rank = 1;

  if v_winner_count = 0 then
    raise exception 'final round % has no ranked entries to declare a winner from', v_final_round.id
      using errcode = 'check_violation';
  end if;

  if v_winner_count > 1 then
    select id into v_tiebreak_id
      from public.tiebreaks
      where round_id = v_final_round.id
        and calculation_id = v_calc_id
        and status = 'resolved'
      order by created_at desc
      limit 1;

    if v_tiebreak_id is null then
      if exists (
        select 1 from public.tiebreaks
        where round_id = v_final_round.id and calculation_id = v_calc_id and status = 'exhausted'
      ) then
        raise exception
          'final round %''s %-way tie at rank 1 survived the tiebreak reserve pool (exhausted); V1 has no co-champion representation (events.winner_participant_id is a single slot) — resolve it outside the app',
          v_final_round.id, v_winner_count
          using errcode = 'check_violation';
      end if;

      raise exception
        'final round % ends in a %-way tie at rank 1; call start_tiebreak(%) to resolve it (sudden-death) before declaring a winner',
        v_final_round.id, v_winner_count, v_final_round.id
        using errcode = 'check_violation';
    end if;

    select participant_id into v_winner_id
      from public.tiebreak_entrants
      where tiebreak_id = v_tiebreak_id and outcome = 'advanced';

    if v_winner_id is null then
      raise exception 'tiebreak % resolved with no advancing participant recorded (data inconsistency)',
        v_tiebreak_id
        using errcode = 'data_exception';
    end if;
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
  'Declares the event champion from the final round''s calculate_results entries: requires the final round scoring_closed with a final calculation and either an untied rank 1, or a resolved (non-stale) QA12 tiebreak naming exactly one advanced entrant. Writes round_participants outcomes and sets events.winner_participant_id. Raises on an unresolved rank-1 tie, directing the admin at start_tiebreak — with a distinct message if the tiebreak pool is already exhausted, since V1 has no co-champion representation to fall back to. Does not conclude the event (T17). Organizer-only.';

revoke all on function public.declare_winner(uuid) from public;
grant execute on function public.declare_winner(uuid) to authenticated;

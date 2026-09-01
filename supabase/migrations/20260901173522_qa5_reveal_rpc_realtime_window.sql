-- QA5 · Realtime reveal RPC + server-authoritative window
--
-- Ships the first piece of live quiz play: an organizer reveals a question,
-- the server stamps timing and issues an unguessable `reveal_token`, and the
-- change reaches participant devices over Supabase Realtime. Two RPCs:
--
--   1. `reveal_question(p_question_id)` — organizer-only. Question must be
--      `pending` in an `active` event whose round is `scoring_open`. Sets
--      `status = window_open`, `revealed_at = now()`, and a fresh
--      `reveal_token`. No custom broadcast code is needed: `questions` is
--      added to the `supabase_realtime` publication below, and Postgres
--      Changes enforces the existing `questions_select` RLS policy per
--      subscriber, so a participant is only pushed reveals for events
--      they've joined (and never a still-`pending` tiebreak-pool row).
--   2. `close_question_window(p_question_id)` — organizer-only. Only
--      succeeds once `window_seconds` has actually elapsed since
--      `revealed_at` (the server verifies the clock, not the caller), so a
--      client can't shrink the window by calling early. Sets
--      `status = window_closed`, `window_closed_at = now()`.
--
-- "Server-authoritative window" does not depend on `close_question_window`
-- ever being called, though: QA2's `private.question_is_window_open` (the
-- predicate `answers_insert_own_open`/`answers_update` gate writes on) is
-- redefined here to also require `now() < revealed_at + window_seconds`.
-- A window is therefore closed-for-writes the instant it expires even if no
-- one's console called the close RPC yet; the RPC's job is the visible
-- `window_closed` status bookkeeping later tickets gate on (QA9's
-- round-close, QA6's disconnect/grace path), not the write boundary itself.
-- Elapsed-time-vs-`reveal_token` grace/replay acceptance is QA6; the
-- unbypassable-by-any-entry-point trigger version of this boundary is QA11.
--
-- Also closes the roster-freeze gap QA3 and T6 both explicitly deferred here
-- ("the participant roster stays open (self-register + approve) through
-- draft and after activation, and freezes at the first question reveal"):
-- a new `participants` trigger blocks new self-registrations and pending ->
-- approved transitions once any question in the event has been revealed.
-- Revoke stays available unconditionally — same escape-valve rationale as
-- the judged-format design (V2) revoking a judge who can't finish.
--
-- Not in scope here: answer submission (QA6), pre-mark matching (QA7), void
-- (QA8), round-close gate (QA9), adjudication (QA10), answers immutability
-- trigger (QA11).

-- ---------------------------------------------------------------------------
-- 1. private.event_has_had_first_reveal — roster-freeze predicate
-- ---------------------------------------------------------------------------
create or replace function private.event_has_had_first_reveal(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.questions q
    join public.segments s on s.id = q.segment_id
    join public.rounds r on r.id = s.round_id
    where r.event_id = p_event_id
      and q.revealed_at is not null
  )
$$;

comment on function private.event_has_had_first_reveal(uuid) is
  'True once any question belonging to the event has been revealed. Drives the participant roster freeze (self-register + approve stop; revoke stays open).';

grant execute on function private.event_has_had_first_reveal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. reveal_question RPC
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, same rationale as T6/QA3's organizer RPCs: no RLS write
-- policy exists for the lifecycle columns this touches beyond the organizer's
-- own raw UPDATE grant, and this is the documented, guard-checked entry point
-- the admin console (QB2) calls.
create or replace function public.reveal_question(p_question_id uuid)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question    public.questions%rowtype;
  v_event_id    uuid;
  v_event_status public.event_status;
  v_round_status public.round_status;
begin
  select * into v_question from public.questions where id = p_question_id for update;

  if not found then
    raise exception 'question % not found', p_question_id
      using errcode = 'no_data_found';
  end if;

  select e.id, e.status, r.status
    into v_event_id, v_event_status, v_round_status
    from public.segments s
    join public.rounds r on r.id = s.round_id
    join public.events e on e.id = r.event_id
    where s.id = v_question.segment_id;

  if auth.uid() is null or not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may reveal question %', p_question_id
      using errcode = '42501';
  end if;

  if v_question.status is distinct from 'pending' then
    raise exception 'question % cannot be revealed from status % (must be pending)',
      p_question_id, v_question.status
      using errcode = 'check_violation';
  end if;

  if v_event_status is distinct from 'active' then
    raise exception 'question % belongs to an event that is not active (status %)',
      p_question_id, v_event_status
      using errcode = 'check_violation';
  end if;

  if v_round_status is distinct from 'scoring_open' then
    raise exception 'question % belongs to a round that is not scoring_open (status %)',
      p_question_id, v_round_status
      using errcode = 'check_violation';
  end if;

  update public.questions
    set status = 'window_open',
        revealed_at = now(),
        reveal_token = gen_random_uuid()::text
    where id = p_question_id
    returning * into v_question;

  return v_question;
end;
$$;

comment on function public.reveal_question(uuid) is
  'Reveals a pending question: stamps revealed_at, issues a fresh reveal_token, and opens the answer window (status = window_open). Requires the owning event to be active and its round scoring_open. Organizer-only. The row update reaches subscribers via Supabase Realtime (questions is in the supabase_realtime publication) filtered by the existing questions_select RLS policy.';

revoke all on function public.reveal_question(uuid) from public;
grant execute on function public.reveal_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. close_question_window RPC
-- ---------------------------------------------------------------------------
create or replace function public.close_question_window(p_question_id uuid)
returns public.questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions%rowtype;
  v_event_id uuid;
begin
  select * into v_question from public.questions where id = p_question_id for update;

  if not found then
    raise exception 'question % not found', p_question_id
      using errcode = 'no_data_found';
  end if;

  select e.id into v_event_id
    from public.segments s
    join public.rounds r on r.id = s.round_id
    join public.events e on e.id = r.event_id
    where s.id = v_question.segment_id;

  if auth.uid() is null or not private.is_event_organizer(v_event_id) then
    raise exception 'only the event organizer may close question %''s window', p_question_id
      using errcode = '42501';
  end if;

  if v_question.status is distinct from 'window_open' then
    raise exception 'question % cannot be closed from status % (must be window_open)',
      p_question_id, v_question.status
      using errcode = 'check_violation';
  end if;

  if now() < v_question.revealed_at + (v_question.window_seconds * interval '1 second') then
    raise exception
      'question %''s window_seconds has not elapsed yet; the server enforces the close time, not the caller',
      p_question_id
      using errcode = 'check_violation';
  end if;

  update public.questions
    set status = 'window_closed',
        window_closed_at = now()
    where id = p_question_id
    returning * into v_question;

  return v_question;
end;
$$;

comment on function public.close_question_window(uuid) is
  'Closes an open question''s answer window (status = window_closed) once window_seconds has actually elapsed since revealed_at; rejects an early close attempt regardless of caller. Organizer-only. Writes are already blocked past the deadline via private.question_is_window_open''s time check below, independent of this RPC ever being called.';

revoke all on function public.close_question_window(uuid) from public;
grant execute on function public.close_question_window(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. private.question_is_window_open — now time-aware (server-authoritative)
-- ---------------------------------------------------------------------------
create or replace function private.question_is_window_open(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.questions q
    where q.id = p_question_id
      and q.status = 'window_open'
      and now() < q.revealed_at + (q.window_seconds * interval '1 second')
  )
$$;

-- ---------------------------------------------------------------------------
-- 5. Roster freeze at first reveal
-- ---------------------------------------------------------------------------
create or replace function private.enforce_participant_roster_freeze()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if private.event_has_had_first_reveal(new.event_id) then
      raise exception
        'the participant roster for event % is frozen: a question has already been revealed',
        new.event_id
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- UPDATE: only the pending -> approved leg (the admit action) freezes.
  -- Revoke stays available unconditionally as the escape valve.
  if new.admission_status = 'approved'
     and old.admission_status is distinct from 'approved'
     and private.event_has_had_first_reveal(new.event_id)
  then
    raise exception
      'the participant roster for event % is frozen: a question has already been revealed',
      new.event_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function private.enforce_participant_roster_freeze() is
  'BEFORE INSERT/UPDATE trigger fn for public.participants: once any question in the event has been revealed, rejects new participant rows (self-register or organizer add) and rejects admitting a pending/revoked participant to approved. Revoking stays available unconditionally. Bound below.';

drop trigger if exists participants_roster_freeze_guard on public.participants;
create trigger participants_roster_freeze_guard
  before insert or update on public.participants
  for each row
  execute function private.enforce_participant_roster_freeze();

-- ---------------------------------------------------------------------------
-- 6. Realtime: broadcast question reveal/close to subscribers
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'questions'
  ) then
    alter publication supabase_realtime add table public.questions;
  end if;
end;
$$;

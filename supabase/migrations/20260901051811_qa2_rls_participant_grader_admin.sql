-- QA2 · RLS (participant self-writes / single grader / admin)
--
-- QA1 enabled RLS on every table with no policies (deny-by-default). This
-- migration adds the V1 access model:
--   * participant — write only their own `answers` row, and only while the
--     question is `window_open`; cannot touch grading columns
--   * grader     — the event's single `events.grader_id`; may UPDATE only
--     `final_correct` (plus graded_by / graded_at / updated_at); SELECT answers
--     and integrity logs; cannot insert answers
--   * organizer  — full access to event structure; SELECT-only on answers
--   * results    — insert-only except the atomic `is_final` flip
--
-- `events.grader_id` is added here because QA1 had no grader identity column,
-- and "admin is read-only on answers" cannot be distinguished from "the
-- grader writes final_correct" without one. Role is per-event (same spirit as
-- T4: organizer vs grader is not a global JWT role).
--
-- Helpers live in `private` so they are not PostgREST RPC. They are SECURITY
-- DEFINER to avoid RLS recursion. Policies are per-operation, `to authenticated`
-- only. Grants match the operations; `anon` is revoked everywhere.
--
-- Window-close / grace-replay immutability is QA11; this ticket only gates
-- participant writes on `questions.status = 'window_open'`.

-- ---------------------------------------------------------------------------
-- 1. Single-grader identity
-- ---------------------------------------------------------------------------
alter table public.events
  add column grader_id uuid references public.profiles (id);

create index events_grader_id_idx on public.events (grader_id);

comment on column public.events.grader_id is
  'The single authoritative grader for a quiz event. Null until assigned; only this profile may write answers.final_correct. Distinct from organizer_id (admin is read-only on answers).';

-- ---------------------------------------------------------------------------
-- 2. private helpers (not exposed via the Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_event_organizer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.organizer_id = (select auth.uid())
  )
$$;

create or replace function private.is_event_grader(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.grader_id is not null
      and e.grader_id = (select auth.uid())
  )
$$;

create or replace function private.is_event_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants p
    where p.event_id = p_event_id
      and p.user_id = (select auth.uid())
  )
$$;

create or replace function private.is_approved_participant(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants p
    where p.event_id = p_event_id
      and p.user_id = (select auth.uid())
      and p.admission_status = 'approved'
  )
$$;

create or replace function private.can_read_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_event_organizer(p_event_id)
    or private.is_event_grader(p_event_id)
    or private.is_event_participant(p_event_id)
$$;

create or replace function private.event_id_from_round(p_round_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.event_id
  from public.rounds r
  where r.id = p_round_id
$$;

create or replace function private.event_id_from_segment(p_segment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.event_id
  from public.segments s
  join public.rounds r on r.id = s.round_id
  where s.id = p_segment_id
$$;

create or replace function private.event_id_from_question(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.event_id
  from public.questions q
  join public.segments s on s.id = q.segment_id
  join public.rounds r on r.id = s.round_id
  where q.id = p_question_id
$$;

create or replace function private.event_id_from_participant(p_participant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.event_id
  from public.participants p
  where p.id = p_participant_id
$$;

create or replace function private.event_id_from_calculation(p_calculation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.event_id
  from public.result_calculations c
  where c.id = p_calculation_id
$$;

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
  )
$$;

create or replace function private.owns_participant(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants p
    where p.id = p_participant_id
      and p.user_id = (select auth.uid())
      and p.admission_status = 'approved'
  )
$$;

grant execute on all functions in schema private to authenticated;
revoke all on all functions in schema private from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Column / immutability guards (RLS cannot see OLD vs NEW)
-- ---------------------------------------------------------------------------
create or replace function private.answers_column_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  event_uuid uuid;
  is_grader boolean;
  is_owner boolean;
begin
  -- service_role / security-definer RPCs (auth.uid() is null) skip the guard.
  if uid is null then
    return new;
  end if;

  select r.event_id into event_uuid
  from public.rounds r
  where r.id = new.round_id;

  select exists (
    select 1 from public.events e
    where e.id = event_uuid
      and e.grader_id = uid
  ) into is_grader;

  select exists (
    select 1 from public.participants p
    where p.id = new.participant_id
      and p.user_id = uid
  ) into is_owner;

  if is_grader then
    if tg_op = 'INSERT' then
      raise exception 'graders cannot insert answers'
        using errcode = '42501';
    end if;
    if new.participant_id     is distinct from old.participant_id
       or new.question_id     is distinct from old.question_id
       or new.round_id        is distinct from old.round_id
       or new.segment_id      is distinct from old.segment_id
       or new.submitted_text  is distinct from old.submitted_text
       or new.submitted_at    is distinct from old.submitted_at
       or new.is_saved_draft  is distinct from old.is_saved_draft
       or new.client_elapsed_ms is distinct from old.client_elapsed_ms
       or new.auto_correct    is distinct from old.auto_correct
       or new.created_at      is distinct from old.created_at
    then
      raise exception 'grader may only write answers.final_correct'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if is_owner then
    if new.final_correct is not null
       or new.graded_by is not null
       or new.graded_at is not null
       or new.auto_correct is not null
    then
      raise exception 'participants cannot write grading columns on answers'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Organizer / other roles: no column rules here. RLS has no write policy for
  -- them, so the INSERT/UPDATE is denied after this trigger returns.
  return new;
end;
$$;

drop trigger if exists answers_column_guard on public.answers;
create trigger answers_column_guard
  before insert or update on public.answers
  for each row
  execute function private.answers_column_guard();

create or replace function private.result_calculations_is_final_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.id            is distinct from old.id
     or new.event_id   is distinct from old.event_id
     or new.round_id   is distinct from old.round_id
     or new.segment_id is distinct from old.segment_id
     or new.calculated_at is distinct from old.calculated_at
     or new.calculated_by is distinct from old.calculated_by
     or new.reason     is distinct from old.reason
  then
    raise exception 'result_calculations rows are insert-only except is_final'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists result_calculations_is_final_only on public.result_calculations;
create trigger result_calculations_is_final_only
  before update on public.result_calculations
  for each row
  execute function private.result_calculations_is_final_only();

-- ---------------------------------------------------------------------------
-- 4. Grants — revoke client defaults, grant only what V1 needs
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.rounds from anon, authenticated;
revoke all on table public.segments from anon, authenticated;
revoke all on table public.participants from anon, authenticated;
revoke all on table public.round_participants from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.question_acceptable_answers from anon, authenticated;
revoke all on table public.answers from anon, authenticated;
revoke all on table public.integrity_events from anon, authenticated;
revoke all on table public.result_calculations from anon, authenticated;
revoke all on table public.result_calculation_exclusions from anon, authenticated;
revoke all on table public.result_calculation_entries from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.rounds to authenticated;
grant select, insert, update, delete on table public.segments to authenticated;
grant select, insert, update, delete on table public.participants to authenticated;
grant select, insert, update, delete on table public.round_participants to authenticated;
grant select, insert, update, delete on table public.questions to authenticated;
grant select, insert, update, delete on table public.question_acceptable_answers to authenticated;
grant select, insert, update on table public.answers to authenticated;
grant select, insert on table public.integrity_events to authenticated;
grant select, insert, update on table public.result_calculations to authenticated;
grant select, insert on table public.result_calculation_exclusions to authenticated;
grant select, insert on table public.result_calculation_entries to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------

-- profiles: own row only (T4 signup writes via SECURITY DEFINER trigger)
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- events
create policy events_select_member
  on public.events for select to authenticated
  using (private.can_read_event(id));

create policy events_insert_organizer
  on public.events for insert to authenticated
  with check (organizer_id = (select auth.uid()));

create policy events_update_organizer
  on public.events for update to authenticated
  using (private.is_event_organizer(id))
  with check (private.is_event_organizer(id) and organizer_id = (select auth.uid()));

create policy events_delete_organizer
  on public.events for delete to authenticated
  using (private.is_event_organizer(id));

-- rounds
create policy rounds_select_member
  on public.rounds for select to authenticated
  using (private.can_read_event(event_id));

create policy rounds_insert_organizer
  on public.rounds for insert to authenticated
  with check (private.is_event_organizer(event_id));

create policy rounds_update_organizer
  on public.rounds for update to authenticated
  using (private.is_event_organizer(event_id))
  with check (private.is_event_organizer(event_id));

create policy rounds_delete_organizer
  on public.rounds for delete to authenticated
  using (private.is_event_organizer(event_id));

-- segments
create policy segments_select_member
  on public.segments for select to authenticated
  using (private.can_read_event(private.event_id_from_round(round_id)));

create policy segments_insert_organizer
  on public.segments for insert to authenticated
  with check (private.is_event_organizer(private.event_id_from_round(round_id)));

create policy segments_update_organizer
  on public.segments for update to authenticated
  using (private.is_event_organizer(private.event_id_from_round(round_id)))
  with check (private.is_event_organizer(private.event_id_from_round(round_id)));

create policy segments_delete_organizer
  on public.segments for delete to authenticated
  using (private.is_event_organizer(private.event_id_from_round(round_id)));

-- participants
create policy participants_select
  on public.participants for select to authenticated
  using (
    private.is_event_organizer(event_id)
    or private.is_event_grader(event_id)
    or user_id = (select auth.uid())
  );

create policy participants_insert_organizer
  on public.participants for insert to authenticated
  with check (private.is_event_organizer(event_id));

create policy participants_update_organizer
  on public.participants for update to authenticated
  using (private.is_event_organizer(event_id))
  with check (private.is_event_organizer(event_id));

create policy participants_delete_organizer
  on public.participants for delete to authenticated
  using (private.is_event_organizer(event_id));

-- round_participants
create policy round_participants_select_member
  on public.round_participants for select to authenticated
  using (private.can_read_event(private.event_id_from_round(round_id)));

create policy round_participants_insert_organizer
  on public.round_participants for insert to authenticated
  with check (private.is_event_organizer(private.event_id_from_round(round_id)));

create policy round_participants_update_organizer
  on public.round_participants for update to authenticated
  using (private.is_event_organizer(private.event_id_from_round(round_id)))
  with check (private.is_event_organizer(private.event_id_from_round(round_id)));

create policy round_participants_delete_organizer
  on public.round_participants for delete to authenticated
  using (private.is_event_organizer(private.event_id_from_round(round_id)));

-- questions: participants see only non-pending (no unpublished / unused tiebreak pool)
create policy questions_select
  on public.questions for select to authenticated
  using (
    private.is_event_organizer(private.event_id_from_question(id))
    or private.is_event_grader(private.event_id_from_question(id))
    or (
      private.is_approved_participant(private.event_id_from_question(id))
      and status <> 'pending'
    )
  );

create policy questions_insert_organizer
  on public.questions for insert to authenticated
  with check (private.is_event_organizer(private.event_id_from_segment(segment_id)));

create policy questions_update_organizer
  on public.questions for update to authenticated
  using (private.is_event_organizer(private.event_id_from_question(id)))
  with check (private.is_event_organizer(private.event_id_from_question(id)));

create policy questions_delete_organizer
  on public.questions for delete to authenticated
  using (private.is_event_organizer(private.event_id_from_question(id)));

-- acceptable answers: organizer + grader only (never participants)
create policy question_acceptable_answers_select_staff
  on public.question_acceptable_answers for select to authenticated
  using (
    private.is_event_organizer(private.event_id_from_question(question_id))
    or private.is_event_grader(private.event_id_from_question(question_id))
  );

create policy question_acceptable_answers_insert_organizer
  on public.question_acceptable_answers for insert to authenticated
  with check (private.is_event_organizer(private.event_id_from_question(question_id)));

create policy question_acceptable_answers_update_organizer
  on public.question_acceptable_answers for update to authenticated
  using (private.is_event_organizer(private.event_id_from_question(question_id)))
  with check (private.is_event_organizer(private.event_id_from_question(question_id)));

create policy question_acceptable_answers_delete_organizer
  on public.question_acceptable_answers for delete to authenticated
  using (private.is_event_organizer(private.event_id_from_question(question_id)));

-- answers
create policy answers_select
  on public.answers for select to authenticated
  using (
    private.is_event_organizer(private.event_id_from_round(round_id))
    or private.is_event_grader(private.event_id_from_round(round_id))
    or private.owns_participant(participant_id)
  );

create policy answers_insert_own_open
  on public.answers for insert to authenticated
  with check (
    private.owns_participant(participant_id)
    and private.question_is_window_open(question_id)
    and final_correct is null
    and graded_by is null
    and graded_at is null
    and auto_correct is null
  );

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
      and final_correct is null
      and graded_by is null
      and graded_at is null
      and auto_correct is null
    )
  );

-- integrity_events
create policy integrity_events_select
  on public.integrity_events for select to authenticated
  using (
    private.is_event_organizer(private.event_id_from_participant(participant_id))
    or private.is_event_grader(private.event_id_from_participant(participant_id))
    or private.owns_participant(participant_id)
  );

create policy integrity_events_insert_own
  on public.integrity_events for insert to authenticated
  with check (private.owns_participant(participant_id));

-- result_calculations: organizer inserts + is_final flip; members can read
create policy result_calculations_select_member
  on public.result_calculations for select to authenticated
  using (private.can_read_event(event_id));

create policy result_calculations_insert_organizer
  on public.result_calculations for insert to authenticated
  with check (private.is_event_organizer(event_id));

create policy result_calculations_update_organizer
  on public.result_calculations for update to authenticated
  using (private.is_event_organizer(event_id))
  with check (private.is_event_organizer(event_id));

create policy result_calculation_exclusions_select_member
  on public.result_calculation_exclusions for select to authenticated
  using (private.can_read_event(private.event_id_from_calculation(calculation_id)));

create policy result_calculation_exclusions_insert_organizer
  on public.result_calculation_exclusions for insert to authenticated
  with check (private.is_event_organizer(private.event_id_from_calculation(calculation_id)));

create policy result_calculation_entries_select_member
  on public.result_calculation_entries for select to authenticated
  using (private.can_read_event(private.event_id_from_calculation(calculation_id)));

create policy result_calculation_entries_insert_organizer
  on public.result_calculation_entries for insert to authenticated
  with check (private.is_event_organizer(private.event_id_from_calculation(calculation_id)));

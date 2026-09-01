-- T10 · Invite-code gen + join RPC
--
-- QA1 gave `events` a `join_code text not null unique` column, but nothing
-- populates it — every existing test inserts one by hand. QA1's `participants`
-- also already has the fields this ticket needs (`user_id`, `admission_status`
-- defaulting to 'pending'), but no policy lets a participant insert their own
-- row: QA2's `participants_insert_organizer` is organizer-only. Two gaps:
--
--   1. `join_code` needs to be generated automatically on event creation
--      rather than chosen by the organizer.
--   2. A self-registering participant needs a way in despite the
--      organizer-only INSERT policy.
--
-- This ships a SECURITY DEFINER `join_event(p_join_code, p_name, p_type,
-- p_members)` RPC: given a valid code, it creates a `pending` participants
-- row for the calling user (or returns their existing one, idempotently).
-- Approving a pending row into 'approved' is QA3's concern, not this
-- ticket's — T10 only gets the participant *in the door* awaiting approval.
--
-- Scope note: the board's T10 card describes a "judge auto-admit" flow
-- against a V2-only `event_judges` table that doesn't exist yet. Per the
-- ticket's actual position in the sequence (Order 9, directly before QA3
-- "participant self-register + admin approve", which depends on T10), this
-- is built as the quiz-participant join step QA3 needs — pending, not
-- auto-admitted. Non-quiz (judged) events aren't supported by this RPC yet,
-- consistent with T6 raising rather than silently no-op-ing on that format.

-- ---------------------------------------------------------------------------
-- 1. One participant row per (event, user) — makes join_event idempotent.
-- ---------------------------------------------------------------------------
create unique index participants_one_per_event_user
  on public.participants (event_id, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- 2. join_code generation
-- ---------------------------------------------------------------------------
-- A Crockford-style 32-char alphabet (excludes 0/O/1/I) keeps codes short and
-- unambiguous to read aloud/type. Plain random() is fine here: a join code is
-- a shareable invite, not a secret credential.
create or replace function private.generate_join_code(p_length integer default 8)
returns text
language plpgsql
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text := '';
begin
  for i in 1..p_length loop
    v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1);
  end loop;
  return v_code;
end;
$$;

comment on function private.generate_join_code(integer) is
  'Generates a random p_length-char invite code from a 32-char unambiguous alphabet. Not cryptographically secure by design -- join codes are shareable invites, not credentials.';

-- BEFORE INSERT trigger: fills events.join_code when the organizer didn't
-- supply one, retrying on collision. SECURITY DEFINER + explicit search_path
-- so the uniqueness check sees every event, not just ones RLS lets the
-- inserting organizer read.
create or replace function public.generate_event_join_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.join_code is not null then
    return new;
  end if;

  loop
    new.join_code := private.generate_join_code(8);
    exit when not exists (
      select 1 from public.events where join_code = new.join_code
    );
  end loop;

  return new;
end;
$$;

comment on function public.generate_event_join_code() is
  'BEFORE INSERT trigger fn for public.events: auto-generates join_code when the organizer omits one, retrying on collision. Bound below.';

drop trigger if exists events_generate_join_code on public.events;
create trigger events_generate_join_code
  before insert on public.events
  for each row
  execute function public.generate_event_join_code();

-- ---------------------------------------------------------------------------
-- 3. join_event RPC
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: participants_insert_organizer (QA2) only lets the
-- organizer insert rows, so a self-registering participant needs a function
-- that bypasses that policy under its own authorization check instead
-- (same rationale as T6's activate_event).
create or replace function public.join_event(
  p_join_code text,
  p_name      text,
  p_type      public.participant_type,
  p_members   text default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event       public.events%rowtype;
  v_participant public.participants%rowtype;
  v_uid         uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'join_event requires an authenticated user'
      using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'participant name is required'
      using errcode = 'check_violation';
  end if;

  select * into v_event from public.events where join_code = p_join_code;

  if not found then
    raise exception 'invalid join code'
      using errcode = 'no_data_found';
  end if;

  if v_event.format is distinct from 'quiz' then
    raise exception
      'self-register join is not implemented for % events (V2, reserved)',
      v_event.format
      using errcode = '0A000';
  end if;

  if v_event.status = 'concluded' then
    raise exception 'event % is concluded and no longer accepting participants',
      v_event.id
      using errcode = 'check_violation';
  end if;

  -- Idempotent: a repeat join by the same user returns their existing row
  -- unchanged instead of raising or creating a duplicate.
  insert into public.participants (event_id, name, type, members, user_id, admission_status)
  values (v_event.id, btrim(p_name), p_type, p_members, v_uid, 'pending')
  on conflict (event_id, user_id) where user_id is not null
  do nothing
  returning * into v_participant;

  if not found then
    select * into v_participant
      from public.participants
      where event_id = v_event.id and user_id = v_uid;
  end if;

  return v_participant;
end;
$$;

comment on function public.join_event(text, text, public.participant_type, text) is
  'Self-registers the calling user as a pending participant in the quiz event matching p_join_code; idempotent on repeat calls (returns the existing row). Admin approval into ''approved'' is QA3''s concern. Raises for unknown codes, non-quiz formats (V2, reserved), and concluded events.';

revoke all on function public.join_event(text, text, public.participant_type, text) from public;
grant execute on function public.join_event(text, text, public.participant_type, text) to authenticated;

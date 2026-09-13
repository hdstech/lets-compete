-- QA19 · Organizer flag
--
-- "Organizer" used to mean "any signed-in user": events_insert_organizer only
-- checked organizer_id = auth.uid(), and every other organizer write hangs off
-- owning an event, so whoever could create an event became an organizer. A
-- judge or participant signed in by magic link could do it — and, once T39
-- enables anonymous sign-ins, so could any anonymous visitor.
--
-- This adds a real capability flag, profiles.is_organizer, and requires it to
-- create an event.
--
-- Where the flag is set: api/organizer-signup.ts, the route behind /signup. It
-- creates the user and then writes is_organizer = true with the secret key.
-- The flag is NOT derived in handle_new_user from a non-empty
-- encrypted_password, because that signal doesn't hold: GoTrue signs a brand
-- new magic-link/OTP user up with a generated temporary password, so their
-- auth.users row carries a password hash too, and every email-link
-- verification issues its token under the same `otp` method. Nothing the
-- database can see tells the two signups apart, so the trusted signal is
-- "created by our own server route" instead. Every other way in (GoTrue's
-- /signup called directly, magic link, invite, anonymous) leaves it false.
-- raw_user_meta_data is never consulted: it is client-writable.
--
-- Delivers:
--   1. profiles.is_organizer (default false; handle_new_user is unchanged).
--   2. A backfill for accounts that already own an event.
--   3. A BEFORE UPDATE guard so a user can't change their own flag.
--   4. private.is_organizer() and the tightened events_insert_organizer.

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column is_organizer boolean not null default false;

comment on column public.profiles.is_organizer is
  'May create events. Set only server-side (api/organizer-signup.ts, or future SECURITY DEFINER code such as T36''s accept-invite RPC); guarded against self-edit by profiles_guard_is_organizer.';

-- ---------------------------------------------------------------------------
-- 2. Backfill
-- ---------------------------------------------------------------------------
-- Owning an event is the only durable evidence that an existing account is
-- already acting as an organizer — for the reason above, encrypted_password
-- can't separate password signups from magic-link users. An organizer who
-- signed up but hasn't created an event yet isn't caught here; promote them
-- by hand (as postgres) if needed. Runs before the guard trigger exists.
update public.profiles p
set is_organizer = true
where exists (
  select 1
  from public.events e
  where e.organizer_id = p.id
);

-- ---------------------------------------------------------------------------
-- 3. Self-edit guard
-- ---------------------------------------------------------------------------
-- profiles_update_own lets a user update any column of their own row. A
-- trigger (rather than column-level grants) blocks just this one column, so
-- this ticket doesn't have to audit which profile columns the client writes.
--
-- SECURITY INVOKER on purpose, so current_user is the caller: `authenticated`
-- or `anon` for PostgREST requests, `service_role` for secret-key requests,
-- and the function owner (`postgres`) inside a SECURITY DEFINER function.
create or replace function private.guard_profiles_is_organizer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_organizer is distinct from old.is_organizer
    and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'profiles.is_organizer can only be changed server-side'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function private.guard_profiles_is_organizer() is
  'BEFORE UPDATE trigger fn on public.profiles: rejects (42501) any is_organizer change outside service_role or postgres-owned SECURITY DEFINER code.';

drop trigger if exists profiles_guard_is_organizer on public.profiles;
create trigger profiles_guard_is_organizer
  before update of is_organizer on public.profiles
  for each row
  execute function private.guard_profiles_is_organizer();

-- ---------------------------------------------------------------------------
-- 4. Gate event creation
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER like the other private helpers, so the check doesn't
-- depend on the caller's profiles RLS. It reads profiles, not events, so it
-- doesn't run into the same-command visibility problem that
-- 20260902170456_fix_events_insert_returning_rls.sql worked around (that fix
-- is on events_select_member and stays untouched).
create or replace function private.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_organizer from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

comment on function private.is_organizer() is
  'True when the calling user''s profile carries the organizer flag (QA19). Required by events_insert_organizer.';

grant execute on function private.is_organizer() to authenticated;

-- T34 will rewrite this check to require org membership; keep
-- `and private.is_organizer()` in that rewrite.
drop policy if exists events_insert_organizer on public.events;
create policy events_insert_organizer
  on public.events for insert to authenticated
  with check (
    organizer_id = (select auth.uid())
    and private.is_organizer()
  );

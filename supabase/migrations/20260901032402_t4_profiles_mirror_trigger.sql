-- T4 · Auth + profiles mirror trigger
--
-- Wires Supabase Auth (auth.users) to the application identity table
-- (public.profiles, created in QA1). Every FK that resolves to a login —
-- events.organizer_id, participants.user_id, event_judges.user_id (V2),
-- answers.graded_by, etc. — points at public.profiles, so a profiles row MUST
-- exist for each auth user. GoTrue only ever writes auth.users; this migration
-- mirrors each new auth user into profiles automatically.
--
-- Delivers:
--   1. handle_new_user() — a SECURITY DEFINER function that inserts a matching
--      profiles row (id, email, name) whenever an auth.users row is created.
--   2. on_auth_user_created — the AFTER INSERT trigger on auth.users that runs it.
--   3. A one-time backfill of any auth users that predate this trigger.
--
-- Not in scope here (manual / later tickets): enabling Email auth + disabling
-- confirmation in the Supabase dashboard, and capturing the admin/judge/judge2
-- JWTs in Insomnia — those are human steps, not schema. RLS on profiles is
-- owned by QA2 (profiles already has RLS enabled deny-by-default from QA1).

-- ---------------------------------------------------------------------------
-- 1. Mirror function
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the function writes public.profiles with its owner's
-- rights: the trigger fires in the `auth` schema context during signup, where
-- the inserting role has no privilege on public.profiles. `set search_path`
-- pins name resolution (defence against search_path hijacking, required for a
-- SECURITY DEFINER function). `on conflict do nothing` keeps it idempotent so a
-- reused id (e.g. the backfill racing a live insert) can never error the signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT trigger fn on auth.users: mirrors each new auth user into public.profiles (id, email, name from raw_user_meta_data). SECURITY DEFINER because it runs in the auth-schema signup context.';

-- ---------------------------------------------------------------------------
-- 2. Trigger on auth.users
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Backfill pre-existing auth users
-- ---------------------------------------------------------------------------
-- Any users created before this trigger existed have no profiles row. Insert
-- them now; on_conflict guards against rows a concurrent signup already mirrored.
insert into public.profiles (id, email, name)
select u.id, u.email, u.raw_user_meta_data ->> 'name'
from auth.users u
on conflict (id) do nothing;

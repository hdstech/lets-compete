-- QB6 · Assign-grader RPC
--
-- QB6 ("grader — batched adjudication screen") needs a real grader account
-- wired to an event before there's anything to adjudicate. QA2 added
-- `events.grader_id` and the `is_event_grader` RLS check, but never shipped a
-- way to *set* it: `profiles` is SELECT-restricted to `id = auth.uid()`
-- (QA2's `profiles_select_own`), so an organizer's client has no way to
-- resolve a grader's email to their `profiles.id` on its own. This RPC fills
-- that gap the same way `join_event` resolves a participant's identity
-- server-side under SECURITY DEFINER, rather than loosening `profiles`' RLS.
--
-- `assign_grader(p_event_id, p_email)` is organizer-only and requires the
-- grader to already have an account (mirrored into `profiles` by T4's
-- signup trigger) — it does not create one. Matching is case-insensitive
-- since email case isn't meaningful for login identity here.

create or replace function public.assign_grader(p_event_id uuid, p_email text)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grader_id uuid;
  v_event     public.events%rowtype;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'only the event organizer may assign a grader'
      using errcode = '42501';
  end if;

  select id into v_grader_id
  from public.profiles
  where lower(email) = lower(p_email);

  if v_grader_id is null then
    raise exception 'no account found for email %', p_email
      using errcode = 'no_data_found';
  end if;

  update public.events
    set grader_id = v_grader_id
    where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

comment on function public.assign_grader(uuid, text) is
  'Organizer-only: resolves p_email to an existing profiles.id and sets it as events.grader_id. Raises if the caller is not the event organizer or no account exists for that email.';

revoke all on function public.assign_grader(uuid, text) from public;
grant execute on function public.assign_grader(uuid, text) to authenticated;

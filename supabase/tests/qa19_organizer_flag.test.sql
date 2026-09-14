-- QA19 · Organizer flag
-- Run: supabase test db
begin;
select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_anonymous
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '19191919-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'organizer@qa19.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"QA19 Organizer"}'::jsonb,
    false
  ),
  (
    -- A magic-link user: GoTrue gives these a generated password hash too,
    -- which is exactly why the hash can't be used to grant the flag.
    '00000000-0000-0000-0000-000000000000',
    '19191919-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'magic-link@qa19.test',
    crypt('generated-temporary-password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    -- Client-writable metadata must never grant the flag.
    '{"name":"QA19 Magic Link","is_organizer":true}'::jsonb,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '19191919-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', null,
    '',
    now(), now(), now(),
    '{"provider":"anonymous","providers":["anonymous"]}'::jsonb,
    '{}'::jsonb,
    true
  );

-- ---------------------------------------------------------------------------
-- New accounts start without the flag, however they were created
-- ---------------------------------------------------------------------------
select ok(
  not (select is_organizer from public.profiles
       where id = '19191919-1111-1111-1111-111111111111'),
  'a new password user starts without organizer capability (only api/organizer-signup grants it)'
);
select ok(
  not (select is_organizer from public.profiles
       where id = '19191919-2222-2222-2222-222222222222'),
  'a new magic-link user is not an organizer, even with is_organizer in user metadata'
);
select ok(
  not (select is_organizer from public.profiles
       where id = '19191919-3333-3333-3333-333333333333'),
  'a new anonymous user is not an organizer'
);

-- ---------------------------------------------------------------------------
-- Trusted contexts may change the flag
-- ---------------------------------------------------------------------------
-- What api/organizer-signup.ts does after creating the user.
set local role service_role;
select lives_ok(
  $$update public.profiles
    set is_organizer = true
    where id = '19191919-1111-1111-1111-111111111111'$$,
  'service_role may change the organizer flag'
);
reset role;
select ok(
  (select is_organizer from public.profiles
   where id = '19191919-1111-1111-1111-111111111111'),
  'the service_role organizer change is persisted'
);

create or replace function pg_temp.as_user(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- A user can't change their own flag, but can still edit their profile
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('19191919-2222-2222-2222-222222222222');

select results_eq(
  $$update public.profiles
    set name = 'Updated Magic Link'
    where id = '19191919-2222-2222-2222-222222222222'
    returning name$$,
  array['Updated Magic Link'],
  'a user may still update their own profile name'
);

select throws_ok(
  $$update public.profiles
    set is_organizer = true
    where id = '19191919-2222-2222-2222-222222222222'$$,
  '42501',
  'profiles.is_organizer can only be changed server-side',
  'a user cannot promote their own profile'
);

select pg_temp.as_user('19191919-1111-1111-1111-111111111111');
select throws_ok(
  $$update public.profiles
    set is_organizer = false
    where id = '19191919-1111-1111-1111-111111111111'$$,
  '42501',
  'profiles.is_organizer can only be changed server-side',
  'an organizer cannot change their own flag either'
);

-- ---------------------------------------------------------------------------
-- Event creation requires the flag
-- ---------------------------------------------------------------------------
select ok(
  private.is_organizer(),
  'private.is_organizer returns true for an organizer'
);
select results_eq(
  $$insert into public.events (
      id, name, organizer_id, format, status, join_code
    ) values (
      '19191919-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'Allowed QA19 Event',
      '19191919-1111-1111-1111-111111111111',
      'quiz',
      'draft',
      'QA19YES1'
    )
    returning name$$,
  array['Allowed QA19 Event'],
  'an organizer can create an event and receive the inserted row'
);

select pg_temp.as_user('19191919-2222-2222-2222-222222222222');
select ok(
  not private.is_organizer(),
  'private.is_organizer returns false for a non-organizer'
);
select throws_ok(
  $$insert into public.events (
      id, name, organizer_id, format, status, join_code
    ) values (
      '19191919-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Blocked QA19 Event',
      '19191919-2222-2222-2222-222222222222',
      'quiz',
      'draft',
      'QA19NOPE'
    )$$,
  '42501',
  null,
  'a non-organizer cannot create an event, even as its own organizer_id'
);

select pg_temp.as_user('19191919-3333-3333-3333-333333333333');
select throws_ok(
  $$insert into public.events (
      id, name, organizer_id, format, status, join_code
    ) values (
      '19191919-cccc-cccc-cccc-cccccccccccc',
      'Anonymous QA19 Event',
      '19191919-3333-3333-3333-333333333333',
      'quiz',
      'draft',
      'QA19ANON'
    )$$,
  '42501',
  null,
  'an anonymous user cannot create an event'
);
reset role;

-- ---------------------------------------------------------------------------
-- Future server-side setters (T36's accept-invite RPC) keep working
-- ---------------------------------------------------------------------------
create or replace function pg_temp.promote_organizer(profile_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set is_organizer = true
  where id = profile_id
$$;

set local role authenticated;
select pg_temp.as_user('19191919-2222-2222-2222-222222222222');
select lives_ok(
  $$select pg_temp.promote_organizer('19191919-2222-2222-2222-222222222222')$$,
  'postgres-owned SECURITY DEFINER code may change the organizer flag'
);
reset role;

select ok(
  (select is_organizer from public.profiles
   where id = '19191919-2222-2222-2222-222222222222'),
  'the SECURITY DEFINER organizer change is persisted'
);

select * from finish();
rollback;

-- T10 · Invite-code gen + join RPC
-- Run: supabase test db
begin;
select plan(12);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'organizer@t10.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'participant1@t10.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Participant One"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'participant2@t10.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Participant Two"}'::jsonb
  );

create or replace function pg_temp.as_user(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

insert into public.events (
  id, name, organizer_id, format, status
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'T10 Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft'
);

insert into public.events (
  id, name, organizer_id, format, status, join_code
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'T10 Concluded Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft',
  'CONCLUD1'
);

update public.events set status = 'active' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
update public.events set status = 'concluded' where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- ---------------------------------------------------------------------------
-- Codegen: join_code is auto-populated when the organizer omits it
-- ---------------------------------------------------------------------------
select isnt(
  (select join_code from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  null,
  'join_code is auto-generated when not supplied on insert'
);

select is(
  (select length(join_code) from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  8,
  'the generated join_code is 8 characters'
);

-- Stash the auto-generated code in a GUC while still superuser: once the role
-- switches to a participant below, RLS hides events they haven't joined yet,
-- so a plain SELECT on events.join_code would return NULL.
select set_config(
  't10.event_a_join_code',
  (select join_code from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  false
);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- join_event: happy path creates a pending participant row
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select lives_ok(
  format(
    $$select public.join_event(%L, 'Participant One', 'individual')$$,
    current_setting('t10.event_a_join_code')
  ),
  'a valid join_code creates a participant row'
);

select is(
  (select admission_status from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  'pending'::public.admission_status,
  'the new participant starts pending, not auto-admitted'
);

select is(
  (select count(*)::int from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'exactly one participant row exists for this user'
);

-- ---------------------------------------------------------------------------
-- join_event: idempotent on repeat calls by the same user
-- ---------------------------------------------------------------------------
select lives_ok(
  format(
    $$select public.join_event(%L, 'Participant One Again', 'individual')$$,
    current_setting('t10.event_a_join_code')
  ),
  'a repeat join by the same user does not raise'
);

select is(
  (select count(*)::int from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'a repeat join does not create a duplicate row'
);

select is(
  (select name from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  'Participant One',
  'the repeat join returns the original row unchanged, not the second call''s name'
);

-- ---------------------------------------------------------------------------
-- join_event: a second user gets their own distinct row
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select lives_ok(
  format(
    $$select public.join_event(%L, 'Participant Two', 'individual')$$,
    current_setting('t10.event_a_join_code')
  ),
  'a second user can join the same event with the same code'
);

-- RLS only lets a participant see their own row; check the total as the
-- organizer, who can see every participant on their event.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2,
  'the event now has two distinct participant rows'
);

-- ---------------------------------------------------------------------------
-- join_event: invalid code and concluded event are rejected
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.join_event('NOSUCHCODE', 'Nobody', 'individual')$$,
  'P0002',
  null,
  'an unknown join_code is rejected'
);

select throws_ok(
  $$select public.join_event('CONCLUD1', 'Too Late', 'individual')$$,
  '23514',
  null,
  'joining a concluded event is rejected'
);

reset role;

select * from finish();
rollback;

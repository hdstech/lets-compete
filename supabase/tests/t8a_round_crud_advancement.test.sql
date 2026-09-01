-- T8a · Round CRUD + advancement config
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
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'organizer@t8a.test',
  crypt('password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Organizer"}'::jsonb
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
  id, name, organizer_id, format, status, join_code
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'T8a Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft',
  'T8AJOIN1'
);

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- Advancement config: advancement_n must be positive when set
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.rounds (event_id, name, sequence, advancement_type, advancement_n, is_final_round, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Round 1', 1, 'top_n', 0, false, 'pending')$$,
  '23514',
  null,
  'advancement_n of 0 is rejected'
);

select lives_ok(
  $$insert into public.rounds (id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Round 1', 1, 'top_n', 4, false, 'pending')$$,
  'a positive advancement_n on a non-final round is accepted'
);

select lives_ok(
  $$insert into public.rounds (id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status)
    values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Final', 2, 'top_n', null, true, 'pending')$$,
  'the final round (advancement_n null) is accepted'
);

-- ---------------------------------------------------------------------------
-- Advancement config: at most one final round per event
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.rounds (event_id, name, sequence, advancement_type, advancement_n, is_final_round, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Second Final', 3, 'top_n', null, true, 'pending')$$,
  '23505',
  null,
  'a second final round on the same event is rejected'
);

-- ---------------------------------------------------------------------------
-- Segment CRUD in draft
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.segments (id, round_id, name, sequence)
    values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Segment A', 1)$$,
  'a segment can be added to a round while the event is draft'
);

select lives_ok(
  $$update public.segments set name = 'Segment A renamed' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  'a segment can be edited while the event is draft'
);

-- ---------------------------------------------------------------------------
-- Freeze: activate the event, then rounds/segments config becomes frozen
-- ---------------------------------------------------------------------------
select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select is(
  (select status from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'active'::public.event_status,
  'fixture event is active for the freeze checks below'
);

select throws_ok(
  $$insert into public.rounds (event_id, name, sequence, advancement_type, advancement_n, is_final_round, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Late Round', 3, 'top_n', 2, false, 'pending')$$,
  '23514',
  null,
  'adding a round after activation is rejected'
);

select throws_ok(
  $$update public.rounds set name = 'Renamed' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '23514',
  null,
  'renaming a round''s config after activation is rejected'
);

select throws_ok(
  $$delete from public.rounds where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  '23514',
  null,
  'deleting a round after activation is rejected'
);

select throws_ok(
  $$update public.segments set name = 'Still frozen' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  '23514',
  null,
  'editing a segment after activation is rejected'
);

-- Round-lifecycle columns stay writable post-activation (round 1 was opened
-- by activate_event itself; this just re-confirms the guard didn't block it).
select is(
  (select status from public.rounds where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'scoring_open'::public.round_status,
  'round-lifecycle columns (status) remain writable through activate_event post-freeze'
);

reset role;

select * from finish();
rollback;

-- T6 · Event lifecycle RPC + guards
-- Run: supabase test db
begin;
select plan(10);

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
    'authenticated', 'authenticated', 'organizer@t6.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated', 'authenticated', 'stranger@t6.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Stranger"}'::jsonb
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

-- A quiz event with no round yet, and a judged event, both draft.
insert into public.events (
  id, name, organizer_id, format, status, join_code
) values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'T6 Quiz',
    '11111111-1111-1111-1111-111111111111',
    'quiz',
    'draft',
    'T6JOIN01'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'T6 Judged',
    '11111111-1111-1111-1111-111111111111',
    'judged',
    'draft',
    'T6JOIN02'
  );

-- ---------------------------------------------------------------------------
-- Guard: no round 1 yet -> activation fails
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '23514',
  null,
  'activation fails with no round 1 configured'
);

reset role;

-- Now give the quiz event its round 1 (implicit, no-rounds final round).
insert into public.rounds (
  id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status
) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Final',
  1,
  'top_n',
  null,
  true,
  'pending'
);

-- ---------------------------------------------------------------------------
-- Guard: a stranger (not the organizer) cannot activate
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('55555555-5555-5555-5555-555555555555');

select throws_ok(
  $$select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '42501',
  null,
  'a non-organizer cannot activate the event'
);

reset role;

-- ---------------------------------------------------------------------------
-- Happy path: organizer activates the quiz event
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select status from public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  'active'::public.event_status,
  'activate_event returns the event with status active'
);

reset role;

select is(
  (select status from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'active'::public.event_status,
  'events.status persisted as active'
);

select is(
  (select status from public.rounds where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'scoring_open'::public.round_status,
  'round 1 opened for scoring on activation'
);

select isnt(
  (select scoring_opened_at from public.rounds where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  null,
  'round 1 scoring_opened_at stamped on activation'
);

-- ---------------------------------------------------------------------------
-- Guard: activating an already-active event fails
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '23514',
  null,
  'activation fails once the event is already active'
);

reset role;

-- ---------------------------------------------------------------------------
-- Guard: the events.status transition trigger rejects illegal jumps
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.events set status = 'draft' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  '23514',
  null,
  'active -> draft is rejected by the status transition guard'
);

select lives_ok(
  $$update public.events set status = 'concluded' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'active -> concluded is a legal transition'
);

-- ---------------------------------------------------------------------------
-- Guard: judged format is not implemented in V1
-- ---------------------------------------------------------------------------
insert into public.rounds (
  id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status
) values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Final',
  1,
  'top_n',
  null,
  true,
  'pending'
);

set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.activate_event('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  '0A000',
  'judged format activation is not implemented (V2, reserved)',
  'judged activation raises not-implemented rather than silently succeeding'
);

reset role;

select * from finish();
rollback;

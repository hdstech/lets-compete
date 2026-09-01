-- QA5 · Realtime reveal RPC + server-authoritative window
-- Run: supabase test db
begin;
select plan(21);

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
    'authenticated', 'authenticated', 'organizer@qa5.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'participant1@qa5.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Participant One"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'participant2@qa5.test',
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
  id, name, organizer_id, format, status, join_code
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'QA5 Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft',
  'QA5CODE1'
);

insert into public.rounds (
  id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Round 1', 1, 'top_n', 4, false, 'pending'
);

insert into public.segments (id, round_id, name, sequence) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Segment A', 1
);

insert into public.questions (
  id, segment_id, prompt, answer_type, window_seconds, sequence
) values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Who wrote Romans?', 'text', 30, 1
), (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'How many books in the NT?', 'numeric', 30, 2
);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- reveal_question: guards before the event is even active
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.reveal_question('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '23514',
  null,
  'reveal_question rejects a question whose event is still draft'
);

-- Participant One self-registers and is approved while the roster is open
-- (pre-activation, pre-reveal).
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_event('QA5CODE1', 'Participant One', 'individual');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config(
  'qa5.p1_id',
  (select id::text from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  false
);
select public.approve_participant(current_setting('qa5.p1_id')::uuid);

select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ---------------------------------------------------------------------------
-- reveal_question: organizer-only
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$select public.reveal_question('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '42501',
  null,
  'a non-organizer cannot reveal a question'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.reveal_question('99999999-9999-9999-9999-999999999999'::uuid)$$,
  'P0002',
  null,
  'reveal_question raises for an unknown question id'
);

-- ---------------------------------------------------------------------------
-- reveal_question: happy path
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.reveal_question('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  'the organizer can reveal a pending question in an active, scoring_open round'
);

select is(
  (select status from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'window_open'::public.question_status,
  'reveal_question opens the answer window'
);

select isnt(
  (select reveal_token from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  null,
  'reveal_question issues a reveal_token'
);

select isnt(
  (select revealed_at from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  null,
  'reveal_question stamps revealed_at'
);

select throws_ok(
  $$select public.reveal_question('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '23514',
  null,
  'revealing an already-revealed question is rejected'
);

-- ---------------------------------------------------------------------------
-- close_question_window: cannot close early, closes once elapsed
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.close_question_window('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '23514',
  null,
  'close_question_window rejects an early close before window_seconds elapses'
);

-- Backdate revealed_at (organizer has raw UPDATE on lifecycle columns) to
-- simulate the window having elapsed, rather than sleeping the test suite.
update public.questions
  set revealed_at = now() - interval '1 hour'
  where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$select public.close_question_window('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '42501',
  null,
  'a non-organizer cannot close a question''s window'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$select public.close_question_window('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  'the organizer can close the window once window_seconds has elapsed'
);

select is(
  (select status from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'window_closed'::public.question_status,
  'close_question_window moves the question to window_closed'
);

select isnt(
  (select window_closed_at from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  null,
  'close_question_window stamps window_closed_at'
);

select throws_ok(
  $$select public.close_question_window('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '23514',
  null,
  'closing an already-closed question is rejected'
);

-- ---------------------------------------------------------------------------
-- private.question_is_window_open is time-aware even without an explicit close
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.reveal_question('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid)$$,
  'reveal the second question to check the time-aware window predicate'
);

select ok(
  private.question_is_window_open('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'a freshly revealed question''s window reads as open'
);

update public.questions
  set revealed_at = now() - interval '1 hour'
  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

select ok(
  not private.question_is_window_open('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'the window predicate reads as closed once window_seconds elapses, even though status is still window_open'
);

-- ---------------------------------------------------------------------------
-- Roster freeze at first reveal (self-register + approve stop; revoke stays open)
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select throws_ok(
  $$select public.join_event('QA5CODE1', 'Participant Two', 'individual')$$,
  '23514',
  null,
  'self-register is rejected once a question has been revealed'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  format(
    $$insert into public.participants (event_id, name, type, admission_status)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Walk-in', 'individual', 'pending')$$
  ),
  '23514',
  null,
  'an organizer-added participant row is also rejected once a question has been revealed'
);

select lives_ok(
  format($$select public.revoke_participant(%L::uuid)$$, current_setting('qa5.p1_id')),
  'revoke still works after the roster freezes (escape valve)'
);

select throws_ok(
  format($$select public.approve_participant(%L::uuid)$$, current_setting('qa5.p1_id')),
  '23514',
  null,
  're-approving a revoked participant is rejected once the roster is frozen'
);

reset role;

select * from finish();
rollback;

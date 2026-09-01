-- QA6 · Answer submission API (submit + draft/sendBeacon replay)
-- Run: supabase test db
begin;
select plan(17);

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
    'authenticated', 'authenticated', 'organizer@qa6.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'participant1@qa6.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Participant One"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'outsider@qa6.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Outsider"}'::jsonb
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
  'QA6 Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft',
  'QA6CODE1'
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

-- window_seconds = 30 throughout; the migration's grace constant is 10s.
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
), (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Grace-window question', 'text', 30, 3
), (
  '11110000-0000-0000-0000-000000000001',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Unrecoverably-late question', 'text', 30, 4
), (
  '22220000-0000-0000-0000-000000000002',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Voided question', 'text', 30, 5
);

set local role authenticated;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Participant One joins and is approved before the roster freezes.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_event('QA6CODE1', 'Participant One', 'individual');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config(
  'qa6.p1_id',
  (select id::text from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  false
);
select public.approve_participant(current_setting('qa6.p1_id')::uuid);

-- ---------------------------------------------------------------------------
-- Reject: question not yet revealed
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul', 1000, 'not-a-real-token', false)$$,
  '23514',
  null,
  'submit_answer rejects a question that has not been revealed yet'
);

-- ---------------------------------------------------------------------------
-- Reject: caller has no approved participant row for the event
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.reveal_question('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid);
select set_config(
  'qa6.q1_token',
  (select reveal_token from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  false
);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select throws_ok(
  format(
    $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul', 1000, %L, false)$$,
    current_setting('qa6.q1_token')
  ),
  '42501',
  null,
  'submit_answer rejects a caller with no approved participant row for the event'
);

-- ---------------------------------------------------------------------------
-- Happy path: in-window submit
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select lives_ok(
  format(
    $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul', 5000, %L, false)$$,
    current_setting('qa6.q1_token')
  ),
  'an approved participant can submit within the window'
);

select is(
  (select submitted_text from public.answers
    where participant_id = current_setting('qa6.p1_id')::uuid
      and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'Paul',
  'the submitted answer is written'
);

select is(
  (select is_saved_draft from public.answers
    where participant_id = current_setting('qa6.p1_id')::uuid
      and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  false,
  'a live submit is not flagged as a saved draft'
);

-- Resubmission before the window closes upserts the same row.
select lives_ok(
  format(
    $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul the Apostle', 6000, %L, false)$$,
    current_setting('qa6.q1_token')
  ),
  'resubmitting before the window closes is accepted (upsert)'
);

select is(
  (select submitted_text from public.answers
    where participant_id = current_setting('qa6.p1_id')::uuid
      and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'Paul the Apostle',
  'the resubmission overwrites the prior answer text'
);

select is(
  (select count(*)::int from public.answers
    where participant_id = current_setting('qa6.p1_id')::uuid
      and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1,
  'a resubmission upserts rather than inserting a second row'
);

-- ---------------------------------------------------------------------------
-- Reject: reveal_token mismatch (stale/replayed token)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul', 1000, 'wrong-token', false)$$,
  '23514',
  null,
  'submit_answer rejects a mismatched reveal_token'
);

-- ---------------------------------------------------------------------------
-- Reject: client_elapsed_ms outside the window
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul', 30001, %L, false)$$,
    current_setting('qa6.q1_token')
  ),
  '23514',
  null,
  'submit_answer rejects client_elapsed_ms greater than the window'
);

select throws_ok(
  format(
    $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Paul', -1, %L, false)$$,
    current_setting('qa6.q1_token')
  ),
  '23514',
  null,
  'submit_answer rejects a negative client_elapsed_ms'
);

-- ---------------------------------------------------------------------------
-- Reject: voided question
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.reveal_question('22220000-0000-0000-0000-000000000002'::uuid);
select set_config(
  'qa6.voided_token',
  (select reveal_token from public.questions where id = '22220000-0000-0000-0000-000000000002'),
  false
);
update public.questions set status = 'voided', voided_at = now(), voided_by = '11111111-1111-1111-1111-111111111111'
  where id = '22220000-0000-0000-0000-000000000002';

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  format(
    $$select public.submit_answer('22220000-0000-0000-0000-000000000002'::uuid, 'anything', 1000, %L, false)$$,
    current_setting('qa6.voided_token')
  ),
  '23514',
  null,
  'submit_answer rejects a voided question'
);

-- ---------------------------------------------------------------------------
-- Grace-window replay: window elapsed but still within the 10s grace period
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.reveal_question('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
select set_config(
  'qa6.grace_token',
  (select reveal_token from public.questions where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  false
);
-- 30s window + 5s past it = 35s elapsed, inside the 40s (window + grace) bound.
update public.questions
  set revealed_at = now() - interval '35 seconds'
  where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select lives_ok(
  format(
    $$select public.submit_answer('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 'Twenty-seven', 29500, %L, true)$$,
    current_setting('qa6.grace_token')
  ),
  'a reconnect/sendBeacon replay lands when the window has passed but the server is still within grace'
);

select is(
  (select is_saved_draft from public.answers
    where participant_id = current_setting('qa6.p1_id')::uuid
      and question_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  true,
  'the grace-window replay is recorded as a saved draft'
);

-- ---------------------------------------------------------------------------
-- Unrecoverably late: window + grace have both elapsed
-- ---------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.reveal_question('11110000-0000-0000-0000-000000000001'::uuid);
select set_config(
  'qa6.late_token',
  (select reveal_token from public.questions where id = '11110000-0000-0000-0000-000000000001'),
  false
);
-- 30s window + 10s grace + 5s past that = 45s elapsed.
update public.questions
  set revealed_at = now() - interval '45 seconds'
  where id = '11110000-0000-0000-0000-000000000001';

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  format(
    $$select public.submit_answer('11110000-0000-0000-0000-000000000001'::uuid, 'too late', 29000, %L, true)$$,
    current_setting('qa6.late_token')
  ),
  '23514',
  null,
  'submit_answer rejects a submission arriving after window + grace has elapsed'
);

select is(
  (select count(*)::int from public.answers where question_id = '11110000-0000-0000-0000-000000000001'),
  0,
  'no answer row is written for an unrecoverably-late submission (scores 0 downstream)'
);

-- ---------------------------------------------------------------------------
-- Reject: resubmitting an already-graded answer
-- ---------------------------------------------------------------------------
-- Simulate adjudication (QA10 isn't built yet) with a superuser write. Switch
-- the JWT claim to the organizer first: answers_column_guard only special-
-- cases the grader/owner roles, so an organizer-attributed write falls
-- through its "no column rules here" branch and is allowed unmodified.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
reset role;
update public.answers
  set final_correct = true, graded_by = '11111111-1111-1111-1111-111111111111', graded_at = now()
  where participant_id = (select current_setting('qa6.p1_id')::uuid)
    and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
set local role authenticated;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  format(
    $$select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'changed my mind', 1000, %L, false)$$,
    current_setting('qa6.q1_token')
  ),
  '23514',
  null,
  'submit_answer rejects resubmitting an answer that has already been graded'
);

reset role;

select * from finish();
rollback;

-- QA7 · Auto pre-mark matcher (normalize + acceptable list + numeric equivalence)
-- Run: supabase test db
begin;
select plan(29);

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
    'authenticated', 'authenticated', 'organizer@qa7.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'participant1@qa7.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Participant One"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'participant2@qa7.test',
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
  'QA7 Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft',
  'QA7CODE1'
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
  '22220000-0000-0000-0000-000000000002',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Grader-cannot-call question', 'text', 30, 3
), (
  '33330000-0000-0000-0000-000000000003',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Organizer-is-grader question', 'text', 30, 4
);

insert into public.question_acceptable_answers (question_id, value, is_numeric) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Paul', false),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'The Apostle Paul', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '27', true),
  ('22220000-0000-0000-0000-000000000002', 'Paul', false),
  ('33330000-0000-0000-0000-000000000003', 'Paul', false);

-- ---------------------------------------------------------------------------
-- Unit tests: the matcher's building blocks (pure/SECURITY DEFINER; no auth
-- context needed — run as the superuser fixture role).
-- ---------------------------------------------------------------------------
select is(
  private.normalize_answer_text('  PAUL!!  '),
  'paul',
  'normalize_answer_text trims, lowercases, and strips punctuation'
);

select is(
  private.normalize_answer_text('The   Apostle,  Paul.'),
  'the apostle paul',
  'normalize_answer_text collapses internal whitespace after stripping punctuation'
);

select is(
  private.normalize_answer_text('   '),
  null,
  'normalize_answer_text returns null for blank input'
);

select is(private.parse_numeric_answer('27'), 27::numeric, 'parse_numeric_answer parses a plain integer');
select is(private.parse_numeric_answer('1,027'), 1027::numeric, 'parse_numeric_answer strips thousands-separator commas');
select is(private.parse_numeric_answer('$50'), 50::numeric, 'parse_numeric_answer strips a leading dollar sign');
select is(private.parse_numeric_answer('abc'), null, 'parse_numeric_answer returns null (not an error) for non-numeric input');

select ok(
  private.question_matches_acceptable_answer('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Paul'),
  'an exact acceptable-answer match is correct'
);

select ok(
  private.question_matches_acceptable_answer('dddddddd-dddd-dddd-dddd-dddddddddddd', '  the APOSTLE, paul!'),
  'a normalized synonym match (case/punctuation/whitespace) is correct'
);

select ok(
  not private.question_matches_acceptable_answer('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Peter'),
  'a non-matching text submission is incorrect'
);

select ok(
  private.question_matches_acceptable_answer('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '27.0'),
  'a numeric-equivalent submission ("27.0" vs acceptable "27") is correct'
);

select ok(
  not private.question_matches_acceptable_answer('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '26'),
  'a numeric mismatch is incorrect'
);

select ok(
  not private.question_matches_acceptable_answer('dddddddd-dddd-dddd-dddd-dddddddddddd', null),
  'a null submission never matches'
);

-- ---------------------------------------------------------------------------
-- auto_mark_question_answers: authorization + status/grace guards
-- ---------------------------------------------------------------------------
set local role authenticated;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$select public.auto_mark_question_answers('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '42501',
  null,
  'a non-organizer cannot auto-mark'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.auto_mark_question_answers('99999999-9999-9999-9999-999999999999'::uuid)$$,
  'P0002',
  null,
  'auto_mark_question_answers raises for an unknown question id'
);

select throws_ok(
  $$select public.auto_mark_question_answers('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '23514',
  null,
  'auto_mark_question_answers rejects a question that is not window_closed'
);

-- ---------------------------------------------------------------------------
-- Happy path: text question, two participants, one messy match + one miss
-- ---------------------------------------------------------------------------
select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_event('QA7CODE1', 'Participant One', 'individual');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.join_event('QA7CODE1', 'Participant Two', 'individual');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config(
  'qa7.p1_id',
  (select id::text from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  false
);
select set_config(
  'qa7.p2_id',
  (select id::text from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '33333333-3333-3333-3333-333333333333'),
  false
);
select public.approve_participant(current_setting('qa7.p1_id')::uuid);
select public.approve_participant(current_setting('qa7.p2_id')::uuid);

select public.reveal_question('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid);
select set_config(
  'qa7.q_text_token',
  (select reveal_token from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  false
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, '  PAUL!!  ', 1000, current_setting('qa7.q_text_token'), false);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select public.submit_answer('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'Peter', 1500, current_setting('qa7.q_text_token'), false);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions
  set revealed_at = now() - interval '1 hour'
  where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select public.close_question_window('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid);

select throws_ok(
  $$select public.auto_mark_question_answers('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  '23514',
  null,
  'auto_mark_question_answers rejects a question whose grace period has not elapsed since window_closed_at'
);

update public.questions
  set window_closed_at = now() - interval '15 seconds'
  where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

select lives_ok(
  $$select public.auto_mark_question_answers('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  'the organizer can auto-mark once window_closed + grace has elapsed'
);

-- auto_mark_question_answers clears the request JWT claim before its write
-- (see the migration comment); re-establish the organizer's identity for the
-- RLS-guarded reads and RPC calls that follow.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select auto_correct from public.answers
    where participant_id = current_setting('qa7.p1_id')::uuid
      and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  true,
  'a messy but matching submission ("  PAUL!!  ") is auto-marked correct'
);

select is(
  (select auto_correct from public.answers
    where participant_id = current_setting('qa7.p2_id')::uuid
      and question_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  false,
  'a non-matching submission ("Peter") is auto-marked incorrect'
);

select is(
  (select count(*)::int from public.auto_mark_question_answers('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)),
  0,
  'a second auto-mark call is a no-op once every answer is already marked'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- Already-graded answers are excluded from batch marking
-- ---------------------------------------------------------------------------
select public.reveal_question('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid);
select set_config(
  'qa7.q_num_token',
  (select reveal_token from public.questions where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  false
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, '27', 1000, current_setting('qa7.q_num_token'), false);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions
  set revealed_at = now() - interval '1 hour'
  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select public.close_question_window('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid);
update public.questions
  set window_closed_at = now() - interval '15 seconds'
  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

-- Simulate adjudication (QA10 isn't built yet) with a superuser write, same
-- technique QA6's test uses: the organizer-attributed write falls through
-- answers_column_guard's unrestricted "no column rules here" branch.
reset role;
update public.answers
  set final_correct = true, graded_by = '11111111-1111-1111-1111-111111111111', graded_at = now()
  where participant_id = (select current_setting('qa7.p1_id')::uuid)
    and question_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$select public.auto_mark_question_answers('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid)$$,
  'auto-mark succeeds even when its only answer is already graded'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select auto_correct from public.answers
    where participant_id = current_setting('qa7.p1_id')::uuid
      and question_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  null,
  'auto-mark does not touch an already-graded answer''s auto_correct'
);

select is(
  (select final_correct from public.answers
    where participant_id = current_setting('qa7.p1_id')::uuid
      and question_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  true,
  'the pre-existing final_correct grade is untouched'
);

-- ---------------------------------------------------------------------------
-- Organizer-only, even for the event's own grader
-- ---------------------------------------------------------------------------
select public.reveal_question('22220000-0000-0000-0000-000000000002'::uuid);
select set_config(
  'qa7.q_grader_token',
  (select reveal_token from public.questions where id = '22220000-0000-0000-0000-000000000002'),
  false
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer('22220000-0000-0000-0000-000000000002'::uuid, 'Paul', 1000, current_setting('qa7.q_grader_token'), false);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions
  set revealed_at = now() - interval '1 hour'
  where id = '22220000-0000-0000-0000-000000000002';
select public.close_question_window('22220000-0000-0000-0000-000000000002'::uuid);
update public.questions
  set window_closed_at = now() - interval '15 seconds'
  where id = '22220000-0000-0000-0000-000000000002';
update public.events
  set grader_id = '22222222-2222-2222-2222-222222222222'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$select public.auto_mark_question_answers('22220000-0000-0000-0000-000000000002'::uuid)$$,
  '42501',
  null,
  'this event''s grader (who is not the organizer) cannot auto-mark'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select lives_ok(
  $$select public.auto_mark_question_answers('22220000-0000-0000-0000-000000000002'::uuid)$$,
  'the organizer can auto-mark regardless of who is assigned as grader'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select auto_correct from public.answers
    where participant_id = current_setting('qa7.p1_id')::uuid
      and question_id = '22220000-0000-0000-0000-000000000002'),
  true,
  'the organizer''s auto-mark writes auto_correct correctly'
);

-- ---------------------------------------------------------------------------
-- Edge case: the organizer is also this event's grader. answers_column_guard
-- would otherwise route this write through the grader branch (final_correct-
-- only) and reject it; auto_mark_question_answers must still succeed.
-- ---------------------------------------------------------------------------
-- Reset grader_id back to the organizer *before* Participant One submits:
-- the prior section left Participant One as events.grader_id, and a grader
-- may not INSERT answers at all (answers_column_guard).
update public.events
  set grader_id = '11111111-1111-1111-1111-111111111111'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select public.reveal_question('33330000-0000-0000-0000-000000000003'::uuid);
select set_config(
  'qa7.q_same_token',
  (select reveal_token from public.questions where id = '33330000-0000-0000-0000-000000000003'),
  false
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer('33330000-0000-0000-0000-000000000003'::uuid, 'Paul', 1000, current_setting('qa7.q_same_token'), false);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions
  set revealed_at = now() - interval '1 hour'
  where id = '33330000-0000-0000-0000-000000000003';
select public.close_question_window('33330000-0000-0000-0000-000000000003'::uuid);
update public.questions
  set window_closed_at = now() - interval '15 seconds'
  where id = '33330000-0000-0000-0000-000000000003';
update public.events
  set grader_id = '11111111-1111-1111-1111-111111111111'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.auto_mark_question_answers('33330000-0000-0000-0000-000000000003'::uuid)$$,
  'auto-mark succeeds even when the organizer is also events.grader_id'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select is(
  (select auto_correct from public.answers
    where participant_id = current_setting('qa7.p1_id')::uuid
      and question_id = '33330000-0000-0000-0000-000000000003'),
  true,
  'auto_correct is written correctly in the organizer-is-grader edge case'
);

reset role;

select * from finish();
rollback;

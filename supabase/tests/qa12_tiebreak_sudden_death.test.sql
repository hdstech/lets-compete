-- QA12 · Sudden-death tiebreak sub-flow
-- Run: supabase test db
begin;
select plan(22);

-- ---------------------------------------------------------------------------
-- Fixtures: organizer, grader, four participants (P1 clear winner, P2/P3
-- tied at round 1's advancement cutoff, P4 clearly eliminated).
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'organizer@qa12.test', crypt('password', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Organizer"}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'grader@qa12.test', crypt('password', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Grader"}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '21111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'p1@qa12.test', crypt('password', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"P1"}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'p2@qa12.test', crypt('password', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"P2"}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '23333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'p3@qa12.test', crypt('password', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"P3"}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '24444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'p4@qa12.test', crypt('password', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"P4"}'::jsonb);

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

insert into public.events (id, name, organizer_id, format, status, join_code) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'QA12 Quiz', '11111111-1111-1111-1111-111111111111',
  'quiz', 'draft', 'QA12CODE'
);

-- Round 1: top 2 advance. Round 2: final.
insert into public.rounds (id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status)
values
  ('b1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Round 1', 1, 'top_n', 2, false, 'pending'),
  ('b2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Final', 2, 'top_n', null, true, 'pending');

insert into public.segments (id, round_id, name, sequence) values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Round 1 Segment', 1),
  ('c2222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Final Segment', 1);

-- Round 1: two scored questions + a two-question tiebreak reserve pool.
insert into public.questions (id, segment_id, prompt, answer_type, window_seconds, sequence, is_tiebreak) values
  ('d1000000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', 'R1 Q1', 'text', 1, 1, false),
  ('d1000000-0000-0000-0000-000000000002', 'c1111111-1111-1111-1111-111111111111', 'R1 Q2', 'text', 1, 2, false),
  ('d1000000-0000-0000-0000-000000000011', 'c1111111-1111-1111-1111-111111111111', 'R1 Tiebreak 1', 'text', 1, 3, true),
  ('d1000000-0000-0000-0000-000000000012', 'c1111111-1111-1111-1111-111111111111', 'R1 Tiebreak 2', 'text', 1, 4, true);

-- Final round: two scored questions, deliberately NO tiebreak reserve pool
-- (used to test the exhausted-pool fallback in declare_winner below).
insert into public.questions (id, segment_id, prompt, answer_type, window_seconds, sequence, is_tiebreak) values
  ('d2000000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', 'Final Q1', 'text', 1, 1, false),
  ('d2000000-0000-0000-0000-000000000002', 'c2222222-2222-2222-2222-222222222222', 'Final Q2', 'text', 1, 2, false);

set local role authenticated;

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.activate_event('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
update public.events set grader_id = '44444444-4444-4444-4444-444444444444'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Roster: all four join and are approved before the first reveal.
select pg_temp.as_user('21111111-1111-1111-1111-111111111111');
select public.join_event('QA12CODE', 'P1', 'individual');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.join_event('QA12CODE', 'P2', 'individual');
select pg_temp.as_user('23333333-3333-3333-3333-333333333333');
select public.join_event('QA12CODE', 'P3', 'individual');
select pg_temp.as_user('24444444-4444-4444-4444-444444444444');
select public.join_event('QA12CODE', 'P4', 'individual');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select set_config('qa12.p1', (select id::text from public.participants where user_id = '21111111-1111-1111-1111-111111111111'), false);
select set_config('qa12.p2', (select id::text from public.participants where user_id = '22222222-2222-2222-2222-222222222222'), false);
select set_config('qa12.p3', (select id::text from public.participants where user_id = '23333333-3333-3333-3333-333333333333'), false);
select set_config('qa12.p4', (select id::text from public.participants where user_id = '24444444-4444-4444-4444-444444444444'), false);
select public.approve_participant(current_setting('qa12.p1')::uuid);
select public.approve_participant(current_setting('qa12.p2')::uuid);
select public.approve_participant(current_setting('qa12.p3')::uuid);
select public.approve_participant(current_setting('qa12.p4')::uuid);

-- ---------------------------------------------------------------------------
-- Round 1 main questions: P1 gets both right (score 2, clear rank 1); P2 and
-- P3 each get only the first right (score 1, tied for the single remaining
-- advancement slot, cutoff=2); P4 gets nothing right (score 0, eliminated).
-- ---------------------------------------------------------------------------
select public.reveal_question('d1000000-0000-0000-0000-000000000001');
select set_config('qa12.r1q1_token', (select reveal_token from public.questions where id = 'd1000000-0000-0000-0000-000000000001'), false);

select pg_temp.as_user('21111111-1111-1111-1111-111111111111');
select public.submit_answer('d1000000-0000-0000-0000-000000000001', 'right', 500, current_setting('qa12.r1q1_token'), false);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer('d1000000-0000-0000-0000-000000000001', 'right', 500, current_setting('qa12.r1q1_token'), false);
select pg_temp.as_user('23333333-3333-3333-3333-333333333333');
select public.submit_answer('d1000000-0000-0000-0000-000000000001', 'right', 500, current_setting('qa12.r1q1_token'), false);
-- P4 does not answer Q1 (no-show = 0).

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions set revealed_at = now() - interval '5 seconds' where id = 'd1000000-0000-0000-0000-000000000001';
select public.close_question_window('d1000000-0000-0000-0000-000000000001');

select public.reveal_question('d1000000-0000-0000-0000-000000000002');
select set_config('qa12.r1q2_token', (select reveal_token from public.questions where id = 'd1000000-0000-0000-0000-000000000002'), false);

select pg_temp.as_user('21111111-1111-1111-1111-111111111111');
select public.submit_answer('d1000000-0000-0000-0000-000000000002', 'right', 500, current_setting('qa12.r1q2_token'), false);
-- P2, P3, P4 all miss Q2.

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions set revealed_at = now() - interval '5 seconds' where id = 'd1000000-0000-0000-0000-000000000002';
select public.close_question_window('d1000000-0000-0000-0000-000000000002');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.close_round('b1111111-1111-1111-1111-111111111111');

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.adjudicate_round_answers(
  'b1111111-1111-1111-1111-111111111111',
  jsonb_build_array(
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p1')::uuid and question_id = 'd1000000-0000-0000-0000-000000000001'), 'final_correct', true),
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p2')::uuid and question_id = 'd1000000-0000-0000-0000-000000000001'), 'final_correct', true),
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p3')::uuid and question_id = 'd1000000-0000-0000-0000-000000000001'), 'final_correct', true),
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p1')::uuid and question_id = 'd1000000-0000-0000-0000-000000000002'), 'final_correct', true)
  )
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.calculate_results('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b1111111-1111-1111-1111-111111111111');

select set_config(
  'qa12.r1_calc',
  (select id::text from public.result_calculations
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and round_id = 'b1111111-1111-1111-1111-111111111111' and is_final),
  false
);

select is(
  (select count(*)::int from public.result_calculation_entries
    where calculation_id = current_setting('qa12.r1_calc')::uuid and rank = 2),
  2,
  'round 1: P2 and P3 are tied at rank 2 (the advancement boundary)'
);

-- ---------------------------------------------------------------------------
-- start_tiebreak: freezes P2/P3 as the tied cohort.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.start_tiebreak('b1111111-1111-1111-1111-111111111111')$$,
  'start_tiebreak opens a tiebreak for round 1''s tied boundary'
);

select set_config(
  'qa12.tb',
  (select id::text from public.tiebreaks where round_id = 'b1111111-1111-1111-1111-111111111111' and status = 'open'),
  false
);

select is(
  (select slots_to_fill from public.tiebreaks where id = current_setting('qa12.tb')::uuid),
  1,
  'exactly one slot needs to be filled from the two-way tie'
);

select is(
  (select count(*)::int from public.tiebreak_entrants where tiebreak_id = current_setting('qa12.tb')::uuid),
  2,
  'P2 and P3 are frozen as the tiebreak entrants'
);

-- ---------------------------------------------------------------------------
-- Draw #1: both entrants answer correctly — still tied, draw again.
-- ---------------------------------------------------------------------------
select public.draw_tiebreak_question(current_setting('qa12.tb')::uuid);
select set_config(
  'qa12.tb1_id',
  (select question_id::text from public.tiebreak_questions where tiebreak_id = current_setting('qa12.tb')::uuid and resolved_at is null),
  false
);
select set_config('qa12.tb1_token', (select reveal_token from public.questions where id = current_setting('qa12.tb1_id')::uuid), false);

-- A non-entrant (P4) cannot answer a tiebreak question they aren't part of.
select pg_temp.as_user('24444444-4444-4444-4444-444444444444');
select throws_ok(
  format(
    $$select public.submit_answer(%L::uuid, 'guess', 500, %L, false)$$,
    current_setting('qa12.tb1_id'), current_setting('qa12.tb1_token')
  ),
  '42501',
  null,
  'a non-entrant cannot submit an answer to a tiebreak question'
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format($$select public.submit_answer(%L::uuid, 'right', 500, %L, false)$$, current_setting('qa12.tb1_id'), current_setting('qa12.tb1_token')),
  'entrant P2 can submit to the drawn tiebreak question'
);

select pg_temp.as_user('23333333-3333-3333-3333-333333333333');
select lives_ok(
  format($$select public.submit_answer(%L::uuid, 'right', 500, %L, false)$$, current_setting('qa12.tb1_id'), current_setting('qa12.tb1_token')),
  'entrant P3 can submit to the drawn tiebreak question'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions set revealed_at = now() - interval '5 seconds' where id = current_setting('qa12.tb1_id')::uuid;
select public.close_question_window(current_setting('qa12.tb1_id')::uuid);

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.adjudicate_round_answers(
  'b1111111-1111-1111-1111-111111111111',
  jsonb_build_array(
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p2')::uuid and question_id = current_setting('qa12.tb1_id')::uuid), 'final_correct', true),
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p3')::uuid and question_id = current_setting('qa12.tb1_id')::uuid), 'final_correct', true)
  )
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$select public.resolve_tiebreak_question(current_setting('qa12.tb')::uuid)$$,
  'resolving the first draw does not error even when it stays tied'
);

select is(
  (select status from public.tiebreaks where id = current_setting('qa12.tb')::uuid),
  'open'::public.tiebreak_status,
  'the tiebreak is still open: the first question left P2/P3 tied 1-1'
);

select is(
  (select broke_tie from public.tiebreak_questions where tiebreak_id = current_setting('qa12.tb')::uuid and question_id = current_setting('qa12.tb1_id')::uuid),
  false,
  'the first drawn question is recorded as not having broken the tie'
);

-- ---------------------------------------------------------------------------
-- Draw #2: only P2 answers correctly — clean cut, P2 advances.
-- ---------------------------------------------------------------------------
select public.draw_tiebreak_question(current_setting('qa12.tb')::uuid);
select set_config(
  'qa12.tb2_id',
  (select question_id::text from public.tiebreak_questions where tiebreak_id = current_setting('qa12.tb')::uuid and resolved_at is null),
  false
);
select set_config('qa12.tb2_token', (select reveal_token from public.questions where id = current_setting('qa12.tb2_id')::uuid), false);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer(current_setting('qa12.tb2_id')::uuid, 'right', 500, current_setting('qa12.tb2_token'), false);
-- P3 does not answer (no-show = 0 for this draw; cumulative score stays 1).

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions set revealed_at = now() - interval '5 seconds' where id = current_setting('qa12.tb2_id')::uuid;
select public.close_question_window(current_setting('qa12.tb2_id')::uuid);

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.adjudicate_round_answers(
  'b1111111-1111-1111-1111-111111111111',
  jsonb_build_array(
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p2')::uuid and question_id = current_setting('qa12.tb2_id')::uuid), 'final_correct', true)
  )
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.resolve_tiebreak_question(current_setting('qa12.tb')::uuid);

select is(
  (select status from public.tiebreaks where id = current_setting('qa12.tb')::uuid),
  'resolved'::public.tiebreak_status,
  'the second draw produces a clean cut and resolves the tiebreak'
);

select is(
  (select outcome from public.tiebreak_entrants where tiebreak_id = current_setting('qa12.tb')::uuid and participant_id = current_setting('qa12.p2')::uuid),
  'advanced'::public.tiebreak_entrant_outcome,
  'P2 (cumulative 2) is recorded as advanced'
);

select is(
  (select outcome from public.tiebreak_entrants where tiebreak_id = current_setting('qa12.tb')::uuid and participant_id = current_setting('qa12.p3')::uuid),
  'eliminated'::public.tiebreak_entrant_outcome,
  'P3 (cumulative 1) is recorded as eliminated'
);

-- ---------------------------------------------------------------------------
-- advance_round must honor the tiebreak outcome at the boundary rank, not
-- the default co-advance rule.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.advance_round('b1111111-1111-1111-1111-111111111111')$$,
  'advance_round succeeds once the tie is resolved'
);

select is(
  (select status from public.round_participants where round_id = 'b1111111-1111-1111-1111-111111111111' and participant_id = current_setting('qa12.p1')::uuid),
  'advanced'::public.round_participant_status,
  'P1 (clear rank 1) advances'
);

select is(
  (select status from public.round_participants where round_id = 'b1111111-1111-1111-1111-111111111111' and participant_id = current_setting('qa12.p2')::uuid),
  'advanced'::public.round_participant_status,
  'P2 advances per the resolved tiebreak, not a blanket co-advance'
);

select is(
  (select status from public.round_participants where round_id = 'b1111111-1111-1111-1111-111111111111' and participant_id = current_setting('qa12.p3')::uuid),
  'eliminated'::public.round_participant_status,
  'P3 is eliminated per the resolved tiebreak'
);

select is(
  (select status from public.round_participants where round_id = 'b1111111-1111-1111-1111-111111111111' and participant_id = current_setting('qa12.p4')::uuid),
  'eliminated'::public.round_participant_status,
  'P4 (clear last place) is eliminated'
);

select is(
  (select count(*)::int from public.round_participants where round_id = 'b2222222-2222-2222-2222-222222222222' and status = 'active'),
  2,
  'the final round is seeded with exactly the two advancing participants'
);

-- ---------------------------------------------------------------------------
-- Final round: P1 and P2 tie at rank 1 with no reserve pool configured —
-- draw_tiebreak_question must exhaust immediately, and declare_winner must
-- raise (no co-champion representation) rather than pick one arbitrarily.
-- ---------------------------------------------------------------------------
select public.reveal_question('d2000000-0000-0000-0000-000000000001');
select set_config('qa12.f1_token', (select reveal_token from public.questions where id = 'd2000000-0000-0000-0000-000000000001'), false);

select pg_temp.as_user('21111111-1111-1111-1111-111111111111');
select public.submit_answer('d2000000-0000-0000-0000-000000000001', 'right', 500, current_setting('qa12.f1_token'), false);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select public.submit_answer('d2000000-0000-0000-0000-000000000001', 'right', 500, current_setting('qa12.f1_token'), false);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
update public.questions set revealed_at = now() - interval '5 seconds' where id = 'd2000000-0000-0000-0000-000000000001';
select public.close_question_window('d2000000-0000-0000-0000-000000000001');
select public.reveal_question('d2000000-0000-0000-0000-000000000002');
update public.questions set revealed_at = now() - interval '5 seconds' where id = 'd2000000-0000-0000-0000-000000000002';
select public.close_question_window('d2000000-0000-0000-0000-000000000002');
-- Neither P1 nor P2 answers Q2 — both stay tied at score 1.

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.close_round('b2222222-2222-2222-2222-222222222222');

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select public.adjudicate_round_answers(
  'b2222222-2222-2222-2222-222222222222',
  jsonb_build_array(
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p1')::uuid and question_id = 'd2000000-0000-0000-0000-000000000001'), 'final_correct', true),
    jsonb_build_object('answer_id', (select id from public.answers where participant_id = current_setting('qa12.p2')::uuid and question_id = 'd2000000-0000-0000-0000-000000000001'), 'final_correct', true)
  )
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.calculate_results('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'b2222222-2222-2222-2222-222222222222');
select public.start_tiebreak('b2222222-2222-2222-2222-222222222222');
select set_config(
  'qa12.tb_final',
  (select id::text from public.tiebreaks where round_id = 'b2222222-2222-2222-2222-222222222222' and status = 'open'),
  false
);

select is(
  (select public.draw_tiebreak_question(current_setting('qa12.tb_final')::uuid)),
  null,
  'drawing from an empty reserve pool returns null rather than erroring'
);

select is(
  (select status from public.tiebreaks where id = current_setting('qa12.tb_final')::uuid),
  'exhausted'::public.tiebreak_status,
  'the final-round tiebreak is flagged exhausted once its (empty) pool is drawn'
);

select throws_ok(
  $$select public.declare_winner('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '23514',
  null,
  'declare_winner raises rather than guessing a champion once the tiebreak pool is exhausted'
);

reset role;

select * from finish();
rollback;

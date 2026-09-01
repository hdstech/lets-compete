-- QA2 · RLS allow/deny suite
-- Run: supabase test db
begin;
select plan(28);

-- ---------------------------------------------------------------------------
-- Auth users → profiles (T4 trigger)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'organizer@qa2.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'grader@qa2.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Grader"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'p1@qa2.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"P1"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated', 'p2@qa2.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"P2"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated', 'authenticated', 'stranger@qa2.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Stranger"}'::jsonb
  );

select ok(
  (select count(*) from public.profiles) = 5,
  'T4 trigger mirrored five auth users into profiles'
);

-- Fixture (postgres bypasses RLS)
insert into public.events (
  id, name, organizer_id, grader_id, format, status, join_code
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'QA2 Quiz',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'quiz',
  'active',
  'QA2JOIN1'
);

insert into public.rounds (
  id, event_id, name, sequence, advancement_type, advancement_n, is_final_round, status
) values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Round 1',
  1,
  'top_n',
  2,
  false,
  'scoring_open'
);

insert into public.segments (id, round_id, name, sequence) values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Segment 1',
  1
);

insert into public.questions (
  id, segment_id, prompt, answer_type, window_seconds, sequence, status
) values (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Who?',
  'text',
  30,
  1,
  'pending'
);

insert into public.question_acceptable_answers (id, question_id, value, is_numeric)
values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'Paul',
  false
);

insert into public.participants (
  id, event_id, name, type, user_id, admission_status, status
) values
  (
    'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'P1',
    'individual',
    '33333333-3333-3333-3333-333333333333',
    'approved',
    'eligible'
  ),
  (
    'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'P2',
    'individual',
    '44444444-4444-4444-4444-444444444444',
    'approved',
    'eligible'
  );

-- Grants: anon holds nothing
select ok(
  not has_table_privilege('anon', 'public.answers', 'select,insert,update,delete'),
  'anon holds no grant on answers'
);
select ok(
  not has_table_privilege('anon', 'public.events', 'select'),
  'anon holds no select grant on events'
);

-- ---------------------------------------------------------------------------
-- Identity helper
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- anon denied by grant
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select * from public.events$$,
  '42501',
  null,
  'anon cannot select events'
);
reset role;

-- ---------------------------------------------------------------------------
-- Membership reads
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select results_eq(
  $$select name from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  array['QA2 Quiz'],
  'organizer reads their event'
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select results_eq(
  $$select name from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  array['QA2 Quiz'],
  'grader reads the event they grade'
);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select results_eq(
  $$select name from public.events where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  array['QA2 Quiz'],
  'participant reads their event'
);

select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
select is_empty(
  $$select * from public.events$$,
  'stranger reads no events'
);

-- Pending questions hidden from participants; staff can see them
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is_empty(
  $$select * from public.questions$$,
  'participant cannot see pending questions'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select results_eq(
  $$select prompt from public.questions where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  array['Who?'],
  'organizer can see pending questions'
);

-- Acceptable answers hidden from participants
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is_empty(
  $$select * from public.question_acceptable_answers$$,
  'participant cannot read acceptable answers'
);

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select results_eq(
  $$select value from public.question_acceptable_answers
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  array['Paul'],
  'grader can read acceptable answers'
);

-- Organizer cannot write answers
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$insert into public.answers (
      participant_id, question_id, round_id, segment_id, submitted_text
    ) values (
      'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'Paul'
    )$$,
  '42501',
  null,
  'organizer cannot insert answers'
);

-- Participant cannot submit while window is not open
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$insert into public.answers (
      participant_id, question_id, round_id, segment_id, submitted_text
    ) values (
      'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'Paul'
    )$$,
  '42501',
  null,
  'participant cannot insert answers while question is pending'
);
reset role;

-- Open the window (postgres)
update public.questions
set status = 'window_open'
where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

set local role authenticated;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select results_eq(
  $$insert into public.answers (
      id, participant_id, question_id, round_id, segment_id, submitted_text
    ) values (
      'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
      'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'Paul'
    )
    returning submitted_text$$,
  array['Paul'],
  'participant inserts their own answer while window_open'
);

-- Cannot write another participant's row
select throws_ok(
  $$insert into public.answers (
      participant_id, question_id, round_id, segment_id, submitted_text
    ) values (
      'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'stolen'
    )$$,
  '42501',
  null,
  'participant cannot insert an answer for someone else'
);

-- Cannot set final_correct
select throws_ok(
  $$update public.answers
    set final_correct = true
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$$,
  '23514',
  null,
  'participant cannot write final_correct'
);

select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select is_empty(
  $$select * from public.answers$$,
  'other participant cannot read P1 answers'
);

-- Organizer is read-only on answers
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select results_eq(
  $$select submitted_text from public.answers
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$$,
  array['Paul'],
  'organizer can read answers'
);
select is_empty(
  $$update public.answers
    set submitted_text = 'admin rewrite'
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'
    returning submitted_text$$,
  'organizer cannot update answers'
);

-- Grader writes only final_correct
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select results_eq(
  $$update public.answers
    set final_correct = true,
        graded_by = '22222222-2222-2222-2222-222222222222',
        graded_at = now()
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'
    returning final_correct$$,
  array[true],
  'grader writes final_correct'
);
select throws_ok(
  $$update public.answers
    set submitted_text = 'grader rewrite'
    where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$$,
  '23514',
  null,
  'grader cannot change submitted_text'
);

-- Results: insert-only except is_final
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select results_eq(
  $$insert into public.result_calculations (
      id, event_id, round_id, calculated_by, is_final
    ) values (
      'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '11111111-1111-1111-1111-111111111111',
      true
    )
    returning is_final$$,
  array[true],
  'organizer inserts a result calculation'
);

select results_eq(
  $$insert into public.result_calculation_entries (
      calculation_id, participant_id, total_score, rank
    ) values (
      'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
      'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      1,
      1
    )
    returning rank$$,
  array[1],
  'organizer inserts result entries'
);

select throws_ok(
  $$update public.result_calculations
    set reason = 'tamper'
    where id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'$$,
  '23514',
  null,
  'organizer cannot change result_calculations.reason'
);

select results_eq(
  $$update public.result_calculations
    set is_final = false
    where id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
    returning is_final$$,
  array[false],
  'organizer may flip is_final'
);

select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$insert into public.result_calculations (
      event_id, calculated_by
    ) values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '33333333-3333-3333-3333-333333333333'
    )$$,
  '42501',
  null,
  'participant cannot insert result_calculations'
);

select throws_ok(
  $$update public.result_calculation_entries set rank = 99 returning rank$$,
  '42501',
  null,
  'authenticated has no UPDATE grant on result_calculation_entries'
);

reset role;
select * from finish();
rollback;

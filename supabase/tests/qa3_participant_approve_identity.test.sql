-- QA3 · Participant admin-approve + identity RPC
-- Run: supabase test db
begin;
select plan(18);

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
    'authenticated', 'authenticated', 'organizer@qa3.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Organizer"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'participant1@qa3.test',
    crypt('password', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Participant One"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated', 'participant2@qa3.test',
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
  'QA3 Quiz',
  '11111111-1111-1111-1111-111111111111',
  'quiz',
  'draft',
  'QA3CODE1'
);

set local role authenticated;

-- ---------------------------------------------------------------------------
-- my_participant_identity: requires authentication
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.my_participant_identity('QA3CODE1')$$,
  '42501',
  null,
  'my_participant_identity rejects an unauthenticated caller'
);

-- Participant One joins, then checks their own identity before approval.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select public.join_event('QA3CODE1', 'Participant One', 'individual');

select is(
  ((public.my_participant_identity('QA3CODE1')).admission_status),
  'pending'::public.admission_status,
  'my_participant_identity returns the caller''s own pending row after joining'
);

select throws_ok(
  $$select public.my_participant_identity('NOSUCHCODE')$$,
  'P0002',
  null,
  'my_participant_identity rejects an unknown join_code'
);

-- Participant Two has not joined yet: valid code, no participant row.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select is(
  public.my_participant_identity('QA3CODE1'),
  null,
  'my_participant_identity returns NULL for a valid code the caller has not joined'
);

-- ---------------------------------------------------------------------------
-- approve_participant: organizer-only
-- ---------------------------------------------------------------------------
-- Look up Participant One's row as the organizer (who can read every
-- participant on their event); participant two, the current role, cannot.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select set_config(
  'qa3.p1_id',
  (select id::text from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  false
);

-- Participant One (not the organizer) tries to approve themself.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  format($$select public.approve_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  '42501',
  null,
  'a non-organizer cannot approve a participant'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$select public.approve_participant('99999999-9999-9999-9999-999999999999'::uuid)$$,
  'P0002',
  null,
  'approve_participant raises for an unknown participant id'
);

select lives_ok(
  format($$select public.approve_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  'the organizer can approve a pending participant'
);

select is(
  (select admission_status from public.participants where id = current_setting('qa3.p1_id')::uuid),
  'approved'::public.admission_status,
  'approve_participant moved the row to approved'
);

select throws_ok(
  format($$select public.approve_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  '23514',
  null,
  'approving an already-approved participant is rejected'
);

-- ---------------------------------------------------------------------------
-- revoke_participant: organizer-only, then re-approve
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');

select throws_ok(
  format($$select public.revoke_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  '42501',
  null,
  'a non-organizer cannot revoke a participant'
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select lives_ok(
  format($$select public.revoke_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  'the organizer can revoke an approved participant'
);

select is(
  (select admission_status from public.participants where id = current_setting('qa3.p1_id')::uuid),
  'revoked'::public.admission_status,
  'revoke_participant moved the row to revoked'
);

select throws_ok(
  format($$select public.revoke_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  '23514',
  null,
  'revoking an already-revoked participant is rejected'
);

select lives_ok(
  format($$select public.approve_participant(%L::uuid)$$, current_setting('qa3.p1_id')),
  'the organizer can re-admit a revoked participant back to approved'
);

select is(
  (select admission_status from public.participants where id = current_setting('qa3.p1_id')::uuid),
  'approved'::public.admission_status,
  're-admitting a revoked participant sets admission_status back to approved'
);

-- ---------------------------------------------------------------------------
-- Transition guard: unbypassable even by a raw organizer UPDATE
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    $$update public.participants set admission_status = 'pending' where id = %L::uuid$$,
    current_setting('qa3.p1_id')
  ),
  '23514',
  null,
  'a raw UPDATE back to pending is rejected by the transition guard'
);

-- Participant Two joins pending, organizer revokes them directly (never
-- approved), confirming the pending -> revoked leg works via the RPC too.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');

select public.join_event('QA3CODE1', 'Participant Two', 'individual');

select set_config(
  'qa3.p2_id',
  (select id::text from public.participants
    where event_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '33333333-3333-3333-3333-333333333333'),
  false
);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

select lives_ok(
  format($$select public.revoke_participant(%L::uuid)$$, current_setting('qa3.p2_id')),
  'the organizer can revoke a still-pending participant directly'
);

select is(
  (select admission_status from public.participants where id = current_setting('qa3.p2_id')::uuid),
  'revoked'::public.admission_status,
  'pending -> revoked leaves the row revoked'
);

reset role;

select * from finish();
rollback;

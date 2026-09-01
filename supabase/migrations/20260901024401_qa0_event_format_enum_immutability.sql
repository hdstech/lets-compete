-- QA0 · events.format enum + immutability trigger
--
-- Delivers the two building blocks that make an event's format a permanent,
-- once-only choice:
--   1. the `event_format` enum ('quiz' | 'judged'), the domain of events.format;
--   2. a reusable trigger function that rejects any UPDATE changing an existing
--      row's `format`, in the same spirit as the "a final score is final"
--      immutability rule.
--
-- The `events` table itself is created in QA1; this migration deliberately does
-- NOT run `create trigger ... on public.events` because that table does not yet
-- exist. QA1 binds this function to `events` as a BEFORE UPDATE trigger. Keeping
-- the type + function here lets every later RPC, trigger, and RLS policy assume
-- one immutable format per event for its lifetime.

-- 1. The format domain. `quiz` is the V1 MVP; `judged` is reserved for V2.
create type public.event_format as enum ('quiz', 'judged');

-- 2. Immutability guard. Attach to `events` as `BEFORE UPDATE FOR EACH ROW`
--    (done in QA1). Uses `is distinct from` so it is null-safe, though
--    events.format is NOT NULL in practice.
create or replace function public.prevent_event_format_change()
returns trigger
language plpgsql
as $$
begin
  if new.format is distinct from old.format then
    raise exception
      'events.format is immutable and cannot be changed (was %, attempted %)',
      old.format, new.format
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on type public.event_format is
  'Event input surface and lifecycle: quiz (V1 MVP) or judged (V2, reserved). Set at insert and immutable thereafter.';

comment on function public.prevent_event_format_change() is
  'BEFORE UPDATE trigger fn for public.events: rejects any change to events.format, enforcing the immutable format binding. Bound to events in QA1.';

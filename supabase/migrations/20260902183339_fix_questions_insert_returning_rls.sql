-- Fix: INSERT ... RETURNING on public.questions fails RLS for the
-- inserting organizer, even though questions_insert_organizer's WITH CHECK
-- passes.
--
-- Same root cause as the events fix (20260902170456): RETURNING a
-- just-inserted row also has to satisfy the table's SELECT policy
-- (questions_select), which reaches the organizer check through
-- private.event_id_from_question(id) -- a function-wrapped subquery that
-- re-queries public.questions by the row's own primary key. That subquery
-- can't see a row inserted earlier in the same command, so the RETURNING
-- select silently fails RLS on create even though the row is fully
-- readable right after.
--
-- Fix: add a fast-path organizer check keyed off segment_id -- a column
-- already present on the row being inserted/returned, not the row's own
-- id -- so it needs no self-referential re-query of public.questions.
-- private.event_id_from_segment looks up public.segments/public.rounds
-- instead, which are unaffected by this table's own insert visibility.
-- This doesn't change who can read questions: for any row that already
-- exists, private.event_id_from_question(id) already implies the same
-- result; it only adds visibility for the one command where the
-- id-keyed lookup can't see the row yet.
drop policy if exists questions_select on public.questions;

create policy questions_select
  on public.questions for select to authenticated
  using (
    private.is_event_organizer(private.event_id_from_segment(segment_id))
    or private.is_event_organizer(private.event_id_from_question(id))
    or private.is_event_grader(private.event_id_from_question(id))
    or (
      private.is_approved_participant(private.event_id_from_question(id))
      and status <> 'pending'
    )
  );

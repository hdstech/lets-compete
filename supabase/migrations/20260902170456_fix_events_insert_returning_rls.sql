-- Fix: INSERT ... RETURNING on public.events fails RLS for the inserting
-- organizer, even though events_insert_organizer's WITH CHECK passes.
--
-- Root cause: RETURNING a just-inserted row also has to satisfy the table's
-- SELECT policy (events_select_member), which goes through
-- private.can_read_event -> private.is_event_organizer, both of which query
-- public.events with a fresh subquery. A subquery reached through a function
-- call (SECURITY DEFINER or not, STABLE or not -- verified all three don't
-- matter) does not see a row inserted earlier in the same command; only a
-- direct self-reference to the table being modified gets that visibility,
-- and Postgres refuses direct self-reference in a policy as "infinite
-- recursion detected in policy". So events was the one table where the
-- SELECT policy is forced to look itself up through a function-wrapped
-- subquery, and that self-lookup can't see its own just-inserted row.
-- INSERT is the only affected statement: UPDATE's SELECT-policy re-check
-- looks up an already-committed row that was already visible.
--
-- Fix: give events_select_member a fast-path direct-column check
-- (organizer_id = auth.uid()) that needs no subquery, so it can be
-- evaluated against the row itself instead of re-querying the table. This
-- doesn't change who can read events -- private.can_read_event(id) already
-- implies this for any row that already exists -- it only adds visibility
-- for the one command where the function-based lookup can't see the row.
drop policy if exists events_select_member on public.events;

create policy events_select_member
  on public.events for select to authenticated
  using (
    organizer_id = (select auth.uid())
    or private.can_read_event(id)
  );

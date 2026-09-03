-- QB4 · Realtime: broadcast answer submissions to subscribers
--
-- QB2's LiveConsolePage already subscribes to postgres_changes on
-- public.answers (filtered by round_id) to keep its "who's answered" roster
-- live, but that subscription has never actually delivered anything: the
-- table was never added to the supabase_realtime publication, the same gap
-- QA5 (questions) and QB3 (participants) each hit and fixed for their own
-- tables. It went unnoticed until now because nothing wrote to `answers`
-- from the frontend before QB4's submit_answer call — the admin console's
-- roster only ever reflected its own initial load or a manual
-- reveal/void/close-round refetch, never a participant's live submission.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'answers'
  ) then
    alter publication supabase_realtime add table public.answers;
  end if;
end;
$$;

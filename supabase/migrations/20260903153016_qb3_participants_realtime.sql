-- QB3 · Realtime: broadcast participant admission changes to subscribers
--
-- QB3's waiting-room dashboard subscribes to postgres_changes UPDATE events
-- on public.participants (filtered to the caller's own row via RLS) so a
-- pending participant sees the moment they're approved/revoked without
-- refreshing, and the admin's participants list on EventDetailPage
-- subscribes to the same table (filtered by event_id) to reflect new
-- self-registrations and approve/revoke actions from other tabs. Neither
-- works until the table is in the supabase_realtime publication — QA5 added
-- `questions` for the same reason; `participants` was never added, since
-- QB3 is the first ticket to touch it from the frontend.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end;
$$;

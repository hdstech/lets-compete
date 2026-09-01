-- Smoke test: proves the `supabase db push` migration loop reaches the
-- linked project. Dropped by the next migration once confirmed.
create table if not exists public._migration_smoke_test (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on all AWR tables with default-deny.
-- service_role bypasses RLS automatically (BYPASSRLS attribute), so
-- the backend continues to work via supabase-admin client. anon and
-- authenticated roles have no policies and therefore no access.
-- This is a guardrail against future code that might accidentally
-- use the anon key in a client bundle.
alter table news_items            enable row level security;
alter table ingest_runs           enable row level security;
alter table news_ingest_events    enable row level security;
alter table benchmark_snapshots   enable row level security;

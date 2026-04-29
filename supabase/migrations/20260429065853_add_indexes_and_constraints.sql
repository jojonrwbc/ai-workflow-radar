-- Index news_ingest_events.observed_at to keep purge_stale_ingest_data()
-- on a btree-range scan instead of a sequential scan as the table grows.
create index if not exists idx_news_ingest_events_observed_at
  on news_ingest_events (observed_at);

-- Index ingest_runs.started_at for the same reason — purge filters runs
-- by started_at < now() - interval '90 days'.
create index if not exists idx_ingest_runs_started_at
  on ingest_runs (started_at);

-- Retention function matching setup.md spec.
-- Deletes:
--   * news_ingest_events older than 90 days
--   * ingest_runs older than 90 days with no remaining events
--   * benchmark_snapshots older than 180 days
create or replace function purge_stale_ingest_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from news_ingest_events
   where observed_at < now() - interval '90 days';

  delete from ingest_runs r
   where r.started_at < now() - interval '90 days'
     and not exists (
       select 1 from news_ingest_events e where e.run_id = r.id
     );

  delete from benchmark_snapshots
   where captured_at < now() - interval '180 days';
end;
$$;

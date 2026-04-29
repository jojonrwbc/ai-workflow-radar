# Supabase Setup Runbook

One-time setup steps for the Hook AI Supabase project.
Run each block in the **Supabase SQL Editor** unless noted otherwise.

## 1. Region check

Before provisioning, verify the project lives in an EU region
(`eu-central-1` Frankfurt or `eu-west-1` Ireland). DSGVO requires
EU-residency unless an explicit transfer mechanism is documented.

Dashboard → Project Settings → General → "Region".
If the project is non-EU, create a fresh project in EU and migrate.

## 2. Schema

Apply the canonical schema once:

```sql
\i supabase/schema.sql
-- or paste the contents of supabase/schema.sql into the SQL Editor
```

This creates:
- `news_items`, `news_ingest_events`, `ingest_runs`, `benchmark_snapshots`
- `set_updated_at()` trigger on `news_items`
- `latest_benchmarks()` RPC (used by `/api/benchmarks`)
- `purge_stale_ingest_data()` retention function

## 3. Verify the RPC

The frontend calls `latest_benchmarks()` via PostgREST. Check it exists:

```sql
select * from latest_benchmarks() limit 5;
```

Expected: empty result set on a fresh DB (no benchmark snapshots yet),
no errors.

## 4. Enable pg_cron (retention)

`purge_stale_ingest_data()` deletes:
- `news_ingest_events` older than 90 days
- `ingest_runs` older than 90 days with no remaining events
- `benchmark_snapshots` older than 180 days

Enable the extension once:

Dashboard → Database → Extensions → search `pg_cron` → Enable.

Then schedule the daily run at 03:30 UTC:

```sql
select cron.schedule(
  'awr-purge-stale',
  '30 3 * * *',
  $$select purge_stale_ingest_data();$$
);
```

Verify the schedule is active:

```sql
select jobid, schedule, command, active from cron.job
 where jobname = 'awr-purge-stale';
```

To unschedule later:

```sql
select cron.unschedule('awr-purge-stale');
```

## 5. Manual one-time purge (optional)

Run once after enabling, then let pg_cron handle it daily:

```sql
select purge_stale_ingest_data();
```

## 6. Service role key for the app

In Vercel/your runtime, set:

- `NEXT_PUBLIC_SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only, never
  expose in client bundles)
- `CRON_SECRET` — Bearer token for `/api/cron/ingest` and
  `/api/cron/digest`

The app uses the service role key only inside server runtimes
(`src/lib/supabase-admin.ts`).

## Audit checklist

- [x] Project region is EU
- [x] `schema.sql` applied without errors
- [x] `select * from latest_benchmarks()` works
- [x] `pg_cron` extension enabled
- [x] `awr-purge-stale` job visible in `cron.job`
- [x] Manual `purge_stale_ingest_data()` succeeded once
- [x] `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` set in deployment env

create extension if not exists pgcrypto;

create table if not exists news_items (
  id text primary key,
  title text not null,
  lead text not null,
  why_it_matters text not null,
  source_name text not null,
  source_url text not null,
  image_label text not null,
  image_path text not null,
  published_at timestamptz not null,
  category text not null,
  score integer not null,
  novelty integer not null,
  workflow_fit integer not null,
  signal integer not null,
  obscurity integer not null,
  saved boolean not null default false,
  deep_dive jsonb not null default '[]'::jsonb,
  commands jsonb,
  benchmark jsonb,
  repo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_news_items_published_at
  on news_items (published_at desc);

create table if not exists ingest_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  status text not null,
  source_count integer not null default 0,
  persisted_count integer not null default 0,
  benchmark_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists news_ingest_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ingest_runs(id) on delete cascade,
  news_id text not null references news_items(id) on delete cascade,
  payload jsonb not null,
  observed_at timestamptz not null default now()
);

create index if not exists idx_news_ingest_events_run_id
  on news_ingest_events (run_id);

create index if not exists idx_news_ingest_events_observed_at
  on news_ingest_events (observed_at);

create index if not exists idx_ingest_runs_started_at
  on ingest_runs (started_at);

create table if not exists benchmark_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ingest_runs(id) on delete cascade,
  label text not null,
  value text not null,
  delta text not null,
  score integer not null,
  captured_at timestamptz not null default now()
);

create index if not exists idx_benchmark_snapshots_captured_at
  on benchmark_snapshots (captured_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_news_items_updated_at on news_items;
create trigger trg_news_items_updated_at
before update on news_items
for each row
execute function set_updated_at();

create or replace function latest_benchmarks()
returns table (
  label text,
  value text,
  delta text,
  score integer,
  captured_at timestamptz
)
language sql
stable
as $$
  select distinct on (label)
    label, value, delta, score, captured_at
  from benchmark_snapshots
  order by label, captured_at desc;
$$;

alter table news_items            enable row level security;
alter table ingest_runs           enable row level security;
alter table news_ingest_events    enable row level security;
alter table benchmark_snapshots   enable row level security;

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

# AI Workflow Radar

Mobile-first News App for daily AI updates with focus on MCP, CLI, OSS tooling and benchmark deltas.

## What is implemented now

- Feed and article pages read data from `/api/feed` and `/api/feed/[id]`
- Benchmarks read data from `/api/benchmarks`
- Supabase persistence for:
  - `news_items` (current canonical feed state)
  - `news_ingest_events` (history snapshots per run)
  - `benchmark_snapshots` (time-series benchmark values)
  - `ingest_runs` (pipeline run status and errors)
- Scheduled ingestion endpoints:
  - `GET /api/cron/ingest` daily (configured for 04:00 UTC)
  - `GET /api/cron/digest` daily digest endpoint
- Ingest status endpoint:
  - `GET /api/status`
- Scheduler options:
  - Vercel daily cron (`vercel.json`)
  - GitHub Actions for 2-hour cadence (`.github/workflows/*`)

## Local development

Requirements:
- Node.js 20+
- npm 10+

Install and run:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Supabase setup

1. Create a Supabase project.
2. Run SQL from `supabase/schema.sql` in Supabase SQL editor.
3. Fill env vars in `.env.local`:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
CRON_SECRET=...
```

4. Seed first snapshot manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ingest
```

`CRON_SECRET` is required for `/api/cron/*` endpoints. Requests without a matching `Authorization: Bearer ...` header are rejected.

When Supabase env vars are missing, app falls back to `src/lib/feed-data.ts`.

## Vercel deployment

Production app:
- [https://ai-workflow-radar.vercel.app](https://ai-workflow-radar.vercel.app)

After setting env vars in Vercel project settings, redeploy:

```bash
vercel deploy --prod
```

Vercel cron schedule is defined in `vercel.json`:
- `0 4 * * *` → `/api/cron/ingest`

Note: Vercel cron uses UTC. `0 4 * * *` equals 06:00 in Berlin during summer time.

## 2-hour scheduler (Hobby-friendly)

Use GitHub Actions workflows:
- `.github/workflows/ingest-every-2h.yml` at `10 */2 * * *`
- `.github/workflows/digest-daily.yml` at `35 4 * * *`

Required GitHub repository secrets:
- `AWR_APP_URL` = `https://ai-workflow-radar.vercel.app`
- `AWR_CRON_SECRET` = same value as `CRON_SECRET` in Vercel env vars

## Docker (deploy-ready baseline)

Build and run with Docker Compose:

```bash
docker compose up --build
```

App runs on [http://localhost:3000](http://localhost:3000)

## API routes

- `GET /api/feed?limit=120`
- `GET /api/feed/:id`
- `GET /api/benchmarks`
- `GET /api/repo-assessment?repo=<owner/name>&category=<...>`
- `GET /api/cron/ingest`
- `GET /api/cron/digest`
- `GET /api/status`

## Folder overview

- `src/lib/feed-data.ts` seed data and shared types
- `src/lib/news-store.ts` Supabase read/write and fallback logic
- `src/lib/ingestion.ts` ingestion orchestration
- `src/lib/repo-assessment.ts` GitHub-based repo scoring
- `src/app/api/*` app APIs and cron endpoints
- `.github/workflows/*` external schedulers for Hobby plan
- `supabase/schema.sql` database schema
- `vercel.json` cron configuration

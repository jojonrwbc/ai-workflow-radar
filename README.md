# Hook AI

Mobile-first News App for daily AI updates with focus on MCP, CLI, OSS tooling and benchmark deltas.

## What is implemented now

- Server-rendered home (`src/app/page.tsx`) hydrates feed + benchmarks from Supabase, with client-side polling refresh
- Article pages read data from `/api/feed/[id]`
- Real RSS/Atom ingestion (`src/lib/sources.ts`) from:
  - Simon Willison
  - Anthropic News
  - Hacker News (frontpage)
- Relevance filter on AI/MCP/CLI/agent keywords; falls back to seed (`src/lib/feed-data.ts`) when fewer than 3 real items collected
- Supabase persistence for:
  - `news_items` (current canonical feed state)
  - `news_ingest_events` (history snapshots per run)
  - `benchmark_snapshots` (time-series benchmark values, queried via `latest_benchmarks()` RPC)
  - `ingest_runs` (pipeline run status and errors)
- Scheduled ingestion endpoints:
  - `GET /api/cron/ingest` daily (configured for 04:00 UTC)
  - `GET /api/cron/digest` daily digest endpoint
- Ingest status endpoint:
  - `GET /api/status`
- Scheduler options:
  - Vercel daily cron (`vercel.json`)
  - GitHub Actions for 2-hour cadence (`.github/workflows/*`)
- Hardened `/api/source-image` proxy: SSRF BlockList, manual redirect validation (max 3 hops), 6s timeout, 8MB body cap
- `/api/repo-assessment` with strict `repo` regex validation, npm package validation, in-memory IP rate limit (30/min)

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

# Optional: additional source tuning for Hook AI
HOOKAI_ENABLE_REDDIT=true
HOOKAI_REDDIT_SUBREDDITS=LocalLLaMA,MachineLearning,singularity,OpenAI
HOOKAI_REDDIT_FEEDS=
HOOKAI_ENABLE_YOUTUBE=true
# Format: Name|@handle OR Name|UC... channel ID OR Name|https://youtube.com/@handle
HOOKAI_YOUTUBE_CHANNELS=
# Direct feed URLs if already known
HOOKAI_YOUTUBE_FEEDS=
```

4. Seed first snapshot manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ingest
```

`CRON_SECRET` is required for `/api/cron/*` endpoints. Requests without a matching `Authorization: Bearer ...` header are rejected.

When Supabase env vars are missing, app falls back to `src/lib/feed-data.ts`.

### Add YouTube and Reddit as Sources

You can now ingest:
- Reddit feeds (subreddit RSS, default enabled)
- YouTube channel feeds (RSS via channel ID, handle, or channel URL)

Recommended setup for your mentioned creators:
1. Copy each channel URL (`https://www.youtube.com/@...`) or channel ID (`UC...`).
2. Add them to `HOOKAI_YOUTUBE_CHANNELS` in `.env.local`:

```bash
HOOKAI_YOUTUBE_CHANNELS=\
Jack Roberts|https://www.youtube.com/@...,\
CT3003|https://www.youtube.com/@...,\
Niklas Hansen|https://www.youtube.com/@...,\
Christoph Magnussen|https://www.youtube.com/@...,\
The Morpheus|https://www.youtube.com/@...,\
Jason Lee|https://www.youtube.com/@...
```

For Reddit, you can keep defaults or set exact feeds/subreddits:

```bash
HOOKAI_REDDIT_SUBREDDITS=LocalLLaMA,MachineLearning,singularity,OpenAI,ClaudeAI
```

## Vercel deployment

Production app:
- [https://hook-ai.vercel.app](https://hook-ai.vercel.app)

After setting env vars in Vercel project settings, redeploy:

```bash
vercel deploy --prod
```

Vercel cron schedule is defined in `vercel.json`:
- `0 4 * * *` → `/api/cron/ingest`

Note: Vercel cron uses UTC. `0 4 * * *` equals 06:00 in Berlin during summer time.

## Observability

This project now includes:
- Sentry via `@sentry/nextjs` for error tracking and tracing
- Vercel Web Analytics via `@vercel/analytics`
- Vercel Speed Insights via `@vercel/speed-insights`

Set these env vars in Vercel (and locally if needed):

```bash
NEXT_PUBLIC_SENTRY_DSN=...
SENTRY_AUTH_TOKEN=...    # optional, only needed for source map upload
SENTRY_ORG=...           # optional, only needed for source map upload
SENTRY_PROJECT=...       # optional, only needed for source map upload
```

Then enable Web Analytics and Speed Insights in the Vercel project dashboard.

## CI checks

A GitHub Actions workflow runs on pushes and pull requests to `main`:
- `.github/workflows/ci.yml`
- Executes `npm run lint`, `npm test`, and `npm run build`

## 2-hour scheduler (Hobby-friendly)

Use GitHub Actions workflows:
- `.github/workflows/ingest-every-2h.yml` at `10 */2 * * *`
- `.github/workflows/digest-daily.yml` at `35 4 * * *`

Required GitHub repository secrets:
- `AWR_APP_URL` = `https://hook-ai.vercel.app`
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

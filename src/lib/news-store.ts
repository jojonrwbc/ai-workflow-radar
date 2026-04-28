import {
  benchmarkBoard,
  BenchmarkSummary,
  dailyNews,
  NewsCategory,
  NewsItem,
} from "@/lib/feed-data";
import { getSupabaseAdminClient, hasSupabaseEnv } from "@/lib/supabase-admin";

type DbNewsItemRow = {
  id: string;
  title: string;
  lead: string;
  why_it_matters: string;
  source_name: string;
  source_url: string;
  image_label: string;
  image_path: string;
  published_at: string;
  category: NewsCategory;
  score: number;
  novelty: number;
  workflow_fit: number;
  signal: number;
  obscurity: number;
  saved: boolean;
  deep_dive: unknown;
  commands: unknown;
  benchmark: unknown;
  repo: unknown;
};

type DbBenchmarkSnapshotRow = {
  label: string;
  value: string;
  delta: string;
  score: number;
  captured_at: string;
};

type DbIngestRunRow = {
  id: string;
  mode: string;
  status: string;
  source_count: number;
  persisted_count: number;
  benchmark_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type IngestStatus = {
  latestRunAt: string | null;
  latestRunStatus: "completed" | "failed" | "running" | "skipped" | "none";
  latestRunMode: "interval" | "digest" | "manual" | "unknown";
  latestRunError: string | null;
};

function parseArrayString(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseObject<T extends object>(value: unknown): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as T;
}

function mapDbRowToNewsItem(row: DbNewsItemRow): NewsItem {
  return {
    id: row.id,
    title: row.title,
    lead: row.lead,
    whyItMatters: row.why_it_matters,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    imageLabel: row.image_label,
    imagePath: row.image_path,
    publishedAt: row.published_at,
    category: row.category,
    score: row.score,
    novelty: row.novelty,
    workflowFit: row.workflow_fit,
    signal: row.signal,
    obscurity: row.obscurity,
    saved: row.saved,
    deepDive: parseArrayString(row.deep_dive),
    commands: parseObject<NonNullable<NewsItem["commands"]>>(row.commands),
    benchmark: parseObject<NonNullable<NewsItem["benchmark"]>>(row.benchmark),
    repo: parseObject<NonNullable<NewsItem["repo"]>>(row.repo),
  };
}

function mapNewsItemToDbRow(item: NewsItem): DbNewsItemRow {
  return {
    id: item.id,
    title: item.title,
    lead: item.lead,
    why_it_matters: item.whyItMatters,
    source_name: item.sourceName,
    source_url: item.sourceUrl,
    image_label: item.imageLabel,
    image_path: item.imagePath,
    published_at: item.publishedAt,
    category: item.category,
    score: item.score,
    novelty: item.novelty,
    workflow_fit: item.workflowFit,
    signal: item.signal,
    obscurity: item.obscurity,
    saved: item.saved,
    deep_dive: item.deepDive,
    commands: item.commands ?? null,
    benchmark: item.benchmark ?? null,
    repo: item.repo ?? null,
  };
}

function fallbackSortedNews(limit: number): NewsItem[] {
  return [...dailyNews]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, limit);
}

export async function listNewsItems(limit = 50): Promise<NewsItem[]> {
  if (!hasSupabaseEnv()) {
    return fallbackSortedNews(limit);
  }

  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("news_items")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) {
      if (error) console.error("[news-store] listNewsItems supabase error:", error);
      return fallbackSortedNews(limit);
    }

    return (data as DbNewsItemRow[]).map(mapDbRowToNewsItem);
  } catch (err) {
    console.error("[news-store] listNewsItems threw:", err);
    return fallbackSortedNews(limit);
  }
}

export async function getNewsItemById(id: string): Promise<NewsItem | null> {
  if (!hasSupabaseEnv()) {
    return dailyNews.find((item) => item.id === id) ?? null;
  }

  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("news_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      if (error) console.error("[news-store] getNewsItemById supabase error:", error);
      return dailyNews.find((item) => item.id === id) ?? null;
    }

    return mapDbRowToNewsItem(data as DbNewsItemRow);
  } catch (err) {
    console.error("[news-store] getNewsItemById threw:", err);
    return dailyNews.find((item) => item.id === id) ?? null;
  }
}

export async function listLatestBenchmarks(): Promise<BenchmarkSummary[]> {
  if (!hasSupabaseEnv()) {
    return benchmarkBoard;
  }

  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client.rpc("latest_benchmarks");

    if (error || !data || data.length === 0) {
      if (error) console.error("[news-store] listLatestBenchmarks supabase error:", error);
      return benchmarkBoard;
    }

    return (data as DbBenchmarkSnapshotRow[]).map((row) => ({
      label: row.label,
      value: row.value,
      delta: row.delta,
      score: row.score,
    }));
  } catch (err) {
    console.error("[news-store] listLatestBenchmarks threw:", err);
    return benchmarkBoard;
  }
}

export async function getLatestIngestStatus(): Promise<IngestStatus> {
  if (!hasSupabaseEnv()) {
    return {
      latestRunAt: null,
      latestRunStatus: "none",
      latestRunMode: "unknown",
      latestRunError: "Supabase env vars are missing",
    };
  }

  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("ingest_runs")
      .select("mode, status, error_message, completed_at, started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      if (error) console.error("[news-store] getLatestIngestStatus supabase error:", error);
      return {
        latestRunAt: null,
        latestRunStatus: "none",
        latestRunMode: "unknown",
        latestRunError: error?.message ?? null,
      };
    }

    const statusCandidate = data.status;
    const modeCandidate = data.mode;

    const latestRunStatus: IngestStatus["latestRunStatus"] =
      statusCandidate === "completed" ||
      statusCandidate === "failed" ||
      statusCandidate === "running" ||
      statusCandidate === "skipped"
        ? statusCandidate
        : "none";

    const latestRunMode: IngestStatus["latestRunMode"] =
      modeCandidate === "interval" ||
      modeCandidate === "digest" ||
      modeCandidate === "manual"
        ? modeCandidate
        : "unknown";

    return {
      latestRunAt: data.completed_at ?? data.started_at,
      latestRunStatus,
      latestRunMode,
      latestRunError: data.error_message,
    };
  } catch (err) {
    console.error("[news-store] getLatestIngestStatus threw:", err);
    return {
      latestRunAt: null,
      latestRunStatus: "none",
      latestRunMode: "unknown",
      latestRunError: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export type PersistResult = {
  runId: string;
  persistedCount: number;
  benchmarkCount: number;
  status: "completed" | "skipped" | "failed";
  errorMessage: string | null;
};

export async function persistNewsSnapshot({
  mode,
  items,
  benchmarks,
}: {
  mode: "interval" | "digest" | "manual" | "scrape";
  items: NewsItem[];
  benchmarks: BenchmarkSummary[];
}): Promise<PersistResult> {
  console.log("[news-store] persistNewsSnapshot mode:", mode, "items:", items.length);
  const runId = crypto.randomUUID();

  if (!hasSupabaseEnv()) {
    console.log("[news-store] missing Supabase env, skipping");
    return {
      runId,
      persistedCount: 0,
      benchmarkCount: 0,
      status: "skipped",
      errorMessage: "Supabase env vars are missing",
    };
  }

  const client = getSupabaseAdminClient();
  const startedAt = new Date().toISOString();

  const runInsertPayload: DbIngestRunRow = {
    id: runId,
    mode,
    status: "running",
    source_count: items.length,
    persisted_count: 0,
    benchmark_count: 0,
    error_message: null,
    started_at: startedAt,
    completed_at: null,
  };

  const { error: runInsertError } = await client.from("ingest_runs").insert(runInsertPayload);
  if (runInsertError) {
    throw runInsertError;
  }

  try {
    const newsRows = items.map(mapNewsItemToDbRow);

    const { error: upsertError } = await client
      .from("news_items")
      .upsert(newsRows, { onConflict: "id" });

    if (upsertError) {
      throw upsertError;
    }

    const ingestEventRows = items.map((item) => ({
      run_id: runId,
      news_id: item.id,
      payload: item,
      observed_at: new Date().toISOString(),
    }));

    const { error: eventsError } = await client
      .from("news_ingest_events")
      .insert(ingestEventRows);

    if (eventsError) {
      throw eventsError;
    }

    const benchmarkRows = benchmarks.map((entry) => ({
      id: crypto.randomUUID(),
      run_id: runId,
      label: entry.label,
      value: entry.value,
      delta: entry.delta,
      score: entry.score,
      captured_at: new Date().toISOString(),
    }));

    const { error: benchmarkError } = await client
      .from("benchmark_snapshots")
      .insert(benchmarkRows);

    if (benchmarkError) {
      throw benchmarkError;
    }

    await client
      .from("ingest_runs")
      .update({
        status: "completed",
        persisted_count: items.length,
        benchmark_count: benchmarks.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      runId,
      persistedCount: items.length,
      benchmarkCount: benchmarks.length,
      status: "completed",
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[news-store] persistNewsSnapshot failed:", error);

    await client
      .from("ingest_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      runId,
      persistedCount: 0,
      benchmarkCount: 0,
      status: "failed",
      errorMessage,
    };
  }
}

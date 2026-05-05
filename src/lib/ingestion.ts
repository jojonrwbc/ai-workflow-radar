import {
  benchmarkBoard,
  BenchmarkSummary,
  dailyNews,
  NewsItem,
} from "@/lib/feed-data";
import { persistNewsSnapshot } from "@/lib/news-store";
import { collectFromSourcesReport, SourceCollectionStats } from "@/lib/sources";

const MIN_REAL_ITEMS = 3;

function rankNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export async function collectNewsItems(): Promise<NewsItem[]> {
  const report = await collectFromSourcesReport();
  const fromSources = report.items;
  if (fromSources.length >= MIN_REAL_ITEMS) {
    return rankNews(fromSources);
  }

  console.warn(
    `[ingestion] only ${fromSources.length} real items collected, falling back to seed`,
  );
  return rankNews(dailyNews);
}

export async function collectNewsItemsWithStats(): Promise<{
  items: NewsItem[];
  stats: SourceCollectionStats;
  usedSeedFallback: boolean;
}> {
  const report = await collectFromSourcesReport();
  if (report.items.length >= MIN_REAL_ITEMS) {
    return {
      items: rankNews(report.items),
      stats: report.stats,
      usedSeedFallback: false,
    };
  }

  console.warn(
    `[ingestion] only ${report.items.length} real items collected, falling back to seed`,
  );
  return {
    items: rankNews(dailyNews),
    stats: report.stats,
    usedSeedFallback: true,
  };
}

export async function collectBenchmarkItems(): Promise<BenchmarkSummary[]> {
  return benchmarkBoard;
}

export async function runIngestion(mode: "interval" | "digest" | "manual") {
  const [items, benchmarks] = await Promise.all([
    collectNewsItemsWithStats(),
    collectBenchmarkItems(),
  ]);
  const newsItems = items.items;

  const persistResult = await persistNewsSnapshot({
    mode,
    items: newsItems,
    benchmarks,
  });

  return {
    mode,
    sourceCount: newsItems.length,
    sourceStats: items.stats,
    usedSeedFallback: items.usedSeedFallback,
    benchmarkSourceCount: benchmarks.length,
    persistedCount: persistResult.persistedCount,
    persistedBenchmarkCount: persistResult.benchmarkCount,
    status: persistResult.status,
    runId: persistResult.runId,
    error: persistResult.errorMessage,
    generatedAt: new Date().toISOString(),
  };
}

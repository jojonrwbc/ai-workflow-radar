import {
  benchmarkBoard,
  BenchmarkSummary,
  dailyNews,
  NewsItem,
} from "@/lib/feed-data";
import { persistNewsSnapshot } from "@/lib/news-store";

function rankNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export async function collectNewsItems(): Promise<NewsItem[]> {
  return rankNews(dailyNews);
}

export async function collectBenchmarkItems(): Promise<BenchmarkSummary[]> {
  return benchmarkBoard;
}

export async function runIngestion(mode: "interval" | "digest" | "manual") {
  const [items, benchmarks] = await Promise.all([
    collectNewsItems(),
    collectBenchmarkItems(),
  ]);

  const persistResult = await persistNewsSnapshot({ mode, items, benchmarks });

  return {
    mode,
    sourceCount: items.length,
    benchmarkSourceCount: benchmarks.length,
    persistedCount: persistResult.persistedCount,
    persistedBenchmarkCount: persistResult.benchmarkCount,
    status: persistResult.status,
    runId: persistResult.runId,
    error: persistResult.errorMessage,
    generatedAt: new Date().toISOString(),
  };
}

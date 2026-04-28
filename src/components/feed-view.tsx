"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BenchmarkSummary, NewsItem } from "@/lib/feed-data";

type ViewMode = "builder" | "ai-world" | "releases" | "saved";

const tabs: Array<{ id: ViewMode; label: string }> = [
  { id: "builder", label: "Builder" },
  { id: "ai-world", label: "AI Welt" },
  { id: "releases", label: "Releases" },
  { id: "saved", label: "Saved" },
];

function isBuilderItem(item: NewsItem): boolean {
  return ["MCP", "CLI", "Open Source", "Workflow"].includes(item.category);
}

function isAiWorldItem(item: NewsItem): boolean {
  return ["Model Release", "Benchmark"].includes(item.category);
}

function isReleaseItem(item: NewsItem): boolean {
  const haystack = `${item.title} ${item.lead}`.toLowerCase();
  if (item.category === "Model Release") {
    return true;
  }
  return /(release|update|launch|notes|version|changelog|neuankuendigung)/i.test(haystack);
}

function getVisibleItems(mode: ViewMode, items: NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  if (mode === "saved") {
    return sorted.filter((item) => item.saved);
  }
  if (mode === "builder") {
    return sorted.filter(isBuilderItem);
  }
  if (mode === "ai-world") {
    return sorted.filter(isAiWorldItem);
  }
  if (mode === "releases") {
    return sorted.filter(isReleaseItem);
  }
  return sorted;
}

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}



type FeedApiResponse = {
  items?: NewsItem[];
};

type BenchmarksApiResponse = {
  items?: BenchmarkSummary[];
};

type FeedViewProps = {
  initialItems: NewsItem[];
  initialBenchmarks: BenchmarkSummary[];
};

export function FeedView({ initialItems, initialBenchmarks }: FeedViewProps) {
  const [mode, setMode] = useState<ViewMode>("builder");
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>(initialBenchmarks);

  async function refreshFeed() {
    try {
      const [feedResponse, benchmarkResponse] = await Promise.all([
        fetch("/api/feed?limit=120", { cache: "no-store" }),
        fetch("/api/benchmarks", { cache: "no-store" }),
      ]);
      const [feedPayload, benchmarkPayload] = await Promise.all([
        feedResponse.json() as Promise<FeedApiResponse>,
        benchmarkResponse.json() as Promise<BenchmarksApiResponse>,
      ]);
      startTransition(() => {
        if (Array.isArray(feedPayload.items) && feedPayload.items.length > 0) {
          setItems(feedPayload.items);
        }
        if (Array.isArray(benchmarkPayload.items) && benchmarkPayload.items.length > 0) {
          setBenchmarks(benchmarkPayload.items);
        }
      });
    } catch {
      // Keep current data
    } finally {
    // done
  }
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => refreshFeed(), 120000);
    return () => window.clearInterval(intervalId);
  }, []);

  const visibleItems = getVisibleItems(mode, items);
  const topStories = useMemo(
    () => [...visibleItems].sort((a, b) => b.score - a.score).slice(0, 5),
    [visibleItems],
  );
  const featured = topStories[0];
  const restStories = topStories.slice(1);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--ink)]">
      <ThemeToggle />

      {/* Header */}
      <header className="px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--muted)]">Mo · 28. April 2026 · Vol. 4 · No. 117</p>
          </div>
        </div>
      </header>

      {/* Segmented Control */}
      <div className="px-6">
        <div className="flex overflow-x-auto pb-4">
          <div className="flex gap-1 rounded-2xl bg-[var(--bg-soft)] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  mode === tab.id
                    ? "bg-[var(--bg-panel)] shadow-sm text-[var(--ink)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Story */}
      {featured && (
        <section className="px-6 pb-6">
          <article className="overflow-hidden rounded-3xl bg-[var(--bg-panel)] border border-[var(--line)]">
            <div className="relative h-56 w-full">
              <Image
                src={featured.imagePath}
                alt={featured.imageLabel}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute left-4 top-4">
                <span className="chip accent">
                  No. 1 · {featured.category}
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="display text-3xl leading-tight text-white">
                  {featured.title}
                </h2>
                <p className="mt-2 text-sm text-white/80 line-clamp-2">
                  {featured.lead}
                </p>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* Benchmarks Strip */}
      <section className="px-6 pb-6">
        <div className="flex items-center justify-between">
          <span className="kicker">Today&apos;s bench</span>
          <span className="byline">04:00 UTC sync</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {benchmarks.slice(0, 4).map((entry) => (
            <div
              key={entry.label}
              className="rounded-2xl border border-[var(--line)] bg-[var(--bg-panel)] p-4"
            >
              <p className="byline text-[10px]">{entry.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="sans-display text-2xl">{entry.value}</span>
                <span className="up text-xs">{entry.delta}</span>
              </div>
              <div className="bar mt-3">
                <i style={{ width: `${entry.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stories List */}
      <section className="px-6 pb-28">
        <div className="flex items-center justify-between pb-4">
          <span className="kicker">Inside this issue</span>
          <span className="byline">{visibleItems.length} stories</span>
        </div>

        <div className="flex flex-col">
          {restStories.map((item) => (
            <Link
              key={item.id}
              href={`/article/${item.id}`}
              className="flex gap-4 border-t border-[var(--line)] py-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="kicker text-[10px]">
                    {item.category} · {formatDate(item.publishedAt)}
                  </span>
                </div>
                <h3 className="mt-1 font-semibold leading-snug text-[var(--ink)]">
                  {item.title}
                </h3>
              </div>
              <span className="sans-display text-xl text-[var(--muted)]">
                {item.score}
              </span>
            </Link>
          ))}
        </div>

        {visibleItems.length === 0 && (
          <p className="py-8 text-center text-[var(--muted)]">
            Keine Stories in dieser Kategorie.
          </p>
        )}
      </section>

      {/* Mobile Tab Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--bg-panel)]/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl justify-around">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 ${
                mode === tab.id ? "text-[var(--ink)]" : "text-[var(--muted)]"
              }`}
            >
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
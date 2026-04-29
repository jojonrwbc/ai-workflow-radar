"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle, LanguageToggle } from "@/components/theme-toggle";
import type { BenchmarkSummary, NewsItem } from "@/lib/feed-data";

type ViewMode = "builder" | "ai-world" | "releases";

const tabs: Array<{ id: ViewMode; label: string }> = [
  { id: "builder", label: "Builder News" },
  { id: "ai-world", label: "AI World" },
  { id: "releases", label: "Releases" },
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

function getVisibleItems(
  mode: ViewMode,
  savedOnly: boolean,
  items: NewsItem[],
): NewsItem[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  if (savedOnly) {
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

function shouldBypassImageOptimizer(src: string): boolean {
  return src.startsWith("/api/source-image?");
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
  const [savedOnly, setSavedOnly] = useState(false);
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [benchmarks, setBenchmarks] = useState<BenchmarkSummary[]>(initialBenchmarks);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartYRef = useRef<number | null>(null);
  const pullEnabledRef = useRef(false);
  const storyCloseRef = useRef<HTMLButtonElement | null>(null);
  const storyOpenerRef = useRef<HTMLElement | null>(null);

  async function refreshFeed(options?: {
    signal?: AbortSignal;
    showRefreshingLabel?: boolean;
  }) {
    const showRefreshingLabel = options?.showRefreshingLabel ?? true;
    if (showRefreshingLabel) {
      setIsRefreshing(true);
    }

    function getLanguage(): "de" | "en" {
  if (typeof window === "undefined") return "de";
  return (localStorage.getItem("awr-language") as "de" | "en") || "de";
}

    try {
      const lang = getLanguage();
      const [feedResponse, benchmarkResponse] = await Promise.all([
        fetch(`/api/feed?limit=120&lang=${lang}`, {
          signal: options?.signal,
          cache: "no-store",
        }),
        fetch("/api/benchmarks", {
          signal: options?.signal,
          cache: "no-store",
        }),
      ]);

      const [feedPayload, benchmarkPayload] = await Promise.all([
        feedResponse.json() as Promise<FeedApiResponse>,
        benchmarkResponse.json() as Promise<BenchmarksApiResponse>,
      ]);

      startTransition(() => {
        if (Array.isArray(feedPayload.items) && feedPayload.items.length > 0) {
          setItems(feedPayload.items);
        }

        if (
          Array.isArray(benchmarkPayload.items) &&
          benchmarkPayload.items.length > 0
        ) {
          setBenchmarks(benchmarkPayload.items);
        }
      });
    } catch {
      // Keep current data on fetch failure.
    } finally {
      if (showRefreshingLabel) {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshFeed({ showRefreshingLabel: false, signal: controller.signal });
      }
    }

    const intervalId = window.setInterval(() => {
      refreshFeed({ showRefreshingLabel: false, signal: controller.signal });
    }, 120000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const visibleItems = getVisibleItems(mode, savedOnly, items);
  const savedCount = useMemo(
    () => items.filter((item) => item.saved).length,
    [items],
  );
  const storyItems = useMemo(
    () => [...visibleItems].sort((a, b) => b.score - a.score).slice(0, 12),
    [visibleItems],
  );

  const currentStory = storyItems[storyIndex];

  const storyItemsLength = storyItems.length;
  useEffect(() => {
    if (!storyOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    storyOpenerRef.current = previouslyFocused;

    const focusTimer = window.setTimeout(() => {
      storyCloseRef.current?.focus();
    }, 0);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setStoryOpen(false);
      } else if (event.key === "ArrowLeft") {
        setStoryIndex((current) => {
          if (storyItemsLength === 0) return 0;
          if (current <= 0) return storyItemsLength - 1;
          return current - 1;
        });
      } else if (event.key === "ArrowRight") {
        setStoryIndex((current) => {
          if (storyItemsLength === 0) return 0;
          if (current >= storyItemsLength - 1) return 0;
          return current + 1;
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      storyOpenerRef.current?.focus();
    };
  }, [storyOpen, storyItemsLength]);

  function openStory(index: number) {
    setStoryIndex(index);
    setStoryOpen(true);
  }

  function nextStory() {
    setStoryIndex((current) => {
      if (storyItems.length === 0) return 0;
      if (current >= storyItems.length - 1) return 0;
      return current + 1;
    });
  }

  function prevStory() {
    setStoryIndex((current) => {
      if (storyItems.length === 0) return 0;
      if (current <= 0) return storyItems.length - 1;
      return current - 1;
    });
  }

  function handleStoryTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  }

  function handleStoryTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const endX = event.changedTouches[0]?.clientX;
    if (touchStartX === null || endX === undefined) {
      return;
    }

    const delta = endX - touchStartX;
    if (delta > 40) {
      prevStory();
    } else if (delta < -40) {
      nextStory();
    }

    setTouchStartX(null);
  }

  function handleFeedTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (storyOpen) {
      return;
    }

    if (window.scrollY <= 0) {
      pullEnabledRef.current = true;
      pullStartYRef.current = event.touches[0]?.clientY ?? null;
    } else {
      pullEnabledRef.current = false;
      pullStartYRef.current = null;
      setPullDistance(0);
    }
  }

  function handleFeedTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!pullEnabledRef.current || pullStartYRef.current === null || storyOpen) {
      return;
    }

    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) {
      return;
    }

    const delta = currentY - pullStartYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    setPullDistance(Math.min(delta, 110));
  }

  function handleFeedTouchEnd() {
    if (!pullEnabledRef.current) {
      setPullDistance(0);
      return;
    }

    const shouldRefresh = pullDistance > 78;
    pullEnabledRef.current = false;
    pullStartYRef.current = null;
    setPullDistance(0);

    if (shouldRefresh) {
      refreshFeed({ showRefreshingLabel: true });
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-7 sm:px-8 lg:px-10"
      onTouchStart={handleFeedTouchStart}
      onTouchMove={handleFeedTouchMove}
      onTouchEnd={handleFeedTouchEnd}
    >
      <header className="rounded-3xl border border-[var(--line)] bg-[var(--bg-panel)] px-5 py-6 sm:px-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
            AI Workflow Radar
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSavedOnly((current) => !current)}
              aria-pressed={savedOnly}
              aria-label={savedOnly ? "Saved-Filter aus" : "Saved-Filter an"}
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                savedOnly
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-[var(--bg-soft)] text-[var(--ink)] hover:bg-[var(--bg-panel)]"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill={savedOnly ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {savedOnly && savedCount > 0 ? (
                <span className="sr-only">{savedCount} saved</span>
              ) : null}
            </button>
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
        <h1 className="mt-3 max-w-3xl display text-4xl leading-[1.05] text-[var(--ink)] sm:text-5xl">
          Daily AI feed, reduziert auf das, was wirklich nutzbar ist.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Klare Streams fuer Builder-News, allgemeine KI-Welt und neue Releases.
        </p>
        {isRefreshing ? (
          <p className="mt-3 text-xs text-[var(--muted)]">Aktualisiere Feed ...</p>
        ) : null}
      </header>

      <div
        className="overflow-hidden transition-[height] duration-150 lg:hidden"
        style={{ height: `${Math.max(0, Math.min(pullDistance, 56))}px` }}
      >
        <div className="flex h-14 items-center justify-center text-xs text-[var(--muted)]">
          {pullDistance > 42 ? "Loslassen zum Aktualisieren" : "Nach unten ziehen zum Aktualisieren"}
        </div>
      </div>

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Story News
          </h2>
          <span className="text-xs text-[var(--muted)]">
            {storyItems.length} Highlights · zum Tippen
          </span>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {storyItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openStory(index)}
              className="w-28 shrink-0 text-left"
            >
              <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-[var(--accent)]/60">
                <Image
                  src={item.imagePath}
                  alt={item.imageLabel}
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized={shouldBypassImageOptimizer(item.imagePath)}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] font-medium text-[var(--ink)]">
                {item.title}
              </p>
            </button>
          ))}
        </div>
      </section>

      <nav
        aria-label="Kategoriefilter"
        className="mt-4 flex gap-2 overflow-x-auto pb-1"
      >
        {tabs.map((tab) => {
          const isActive = !savedOnly && mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSavedOnly(false);
                setMode(tab.id);
              }}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-[var(--bg-panel)] text-[var(--ink)] hover:bg-[var(--bg-soft)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-4">
          {visibleItems.map((item, index) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--bg-panel)]"
            >
              <Link href={`/article/${item.id}`} className="block">
                <div className="relative h-44 w-full">
                  <Image
                    src={item.imagePath}
                    alt={item.imageLabel}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 65vw"
                    unoptimized={shouldBypassImageOptimizer(item.imagePath)}
                    priority={index === 0}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <div className="absolute left-3 top-3 z-20 rounded-full border border-[var(--line)] bg-[var(--bg-panel)]/90 px-2.5 py-1 text-xs font-medium text-[var(--ink)]">
                    {item.category}
                  </div>
                </div>

                <div className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                    <span>{formatDate(item.publishedAt)}</span>
                    <span className="rounded-full bg-[var(--bg-soft)] px-2.5 py-1 font-medium text-[var(--ink)]">
                      Score {item.score}
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold leading-snug text-[var(--ink)]">
                    {item.title}
                  </h2>
                  <p className="text-sm leading-6 text-[var(--muted)]">{item.lead}</p>
                </div>
              </Link>

              <div className="rounded-xl bg-[var(--bg-soft)] px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Warum relevant
                </p>
                <p className="mt-1 text-sm text-[var(--ink)]">{item.whyItMatters}</p>
              </div>

              {item.benchmark ? (
                <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--ink)]">{item.benchmark.label}</p>
                    <p className="text-[var(--muted)]">{item.benchmark.value}</p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-soft)] px-2.5 py-1 text-xs font-medium text-[var(--ink)]">
                    {item.benchmark.delta}
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                <span>{item.sourceName}</span>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--ink)] hover:underline"
                >
                  Quelle ansehen
                </a>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-panel)] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Tagesbenchmarks
            </h3>
            <div className="mt-3 space-y-3">
              {benchmarks.map((entry) => (
                <div key={entry.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--ink)]">{entry.label}</span>
                    <span className="text-[var(--muted)]">{entry.value}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--bg-soft)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.min(entry.score, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">Delta {entry.delta}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>

      {storyOpen && currentStory ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="story-modal-title"
          className="fixed inset-0 z-50 bg-black text-white lg:hidden"
          onTouchStart={handleStoryTouchStart}
          onTouchEnd={handleStoryTouchEnd}
        >
          <div className="relative h-full w-full">
            <Image
              src={currentStory.imagePath}
              alt={currentStory.imageLabel}
              fill
              className="object-cover opacity-55"
              sizes="100vw"
              priority
              unoptimized={shouldBypassImageOptimizer(currentStory.imagePath)}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/85" />

            <div className="absolute left-0 right-0 top-0 flex gap-1 px-3 pt-3">
              {storyItems.map((item, index) => (
                <span
                  key={item.id}
                  className={`h-1 flex-1 rounded-full ${
                    index <= storyIndex ? "bg-white" : "bg-white/30"
                  }`}
                />
              ))}
            </div>

            <button
              ref={storyCloseRef}
              type="button"
              onClick={() => setStoryOpen(false)}
              aria-label="Story schliessen"
              className="absolute right-3 top-6 z-30 rounded-full border border-white/60 bg-black/40 px-3 py-1 text-xs font-medium"
            >
              Schliessen
            </button>

            <button
              type="button"
              onClick={prevStory}
              className="absolute left-0 top-0 z-10 h-full w-1/2"
              aria-label="Vorherige Story"
            />
            <button
              type="button"
              onClick={nextStory}
              className="absolute right-0 top-0 z-10 h-full w-1/2"
              aria-label="Naechste Story"
            />

            <div className="absolute bottom-0 left-0 right-0 z-20 space-y-3 px-4 pb-7">
              <p className="text-xs uppercase tracking-[0.08em] text-white/75">
                {currentStory.category} · Score {currentStory.score}
              </p>
              <h3
                id="story-modal-title"
                className="text-3xl font-semibold leading-tight"
              >
                {currentStory.title}
              </h3>
              <p className="text-sm text-white/90">{currentStory.lead}</p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/article/${currentStory.id}`}
                  onClick={() => setStoryOpen(false)}
                  className="rounded-full bg-white px-3 py-2 text-center text-sm font-semibold text-black"
                >
                  Zum Artikel
                </Link>
                <a
                  href={currentStory.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/70 px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Quelle
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
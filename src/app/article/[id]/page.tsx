"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RepoAssessmentCard } from "@/components/repo-assessment-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewsItem } from "@/lib/feed-data";

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function shouldBypassImageOptimizer(src: string): boolean {
  return src.startsWith("/api/source-image?");
}

export default function ArticlePage() {
  const params = useParams<{ id: string }>();
  const articleId = typeof params.id === "string" ? params.id : "";
  const isInvalidId = articleId.length === 0;
  const [item, setItem] = useState<NewsItem | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    isInvalidId ? "error" : "loading",
  );

  useEffect(() => {
    if (isInvalidId) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/feed/${articleId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Artikel nicht gefunden");
        }

        const payload = (await response.json()) as NewsItem;
        setItem(payload);
        setState("ready");
      })
      .catch(() => setState("error"));

    return () => controller.abort();
  }, [articleId, isInvalidId]);

  if (state === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-radar-stroke bg-radar-panel px-5 py-8">
          <p className="text-sm text-radar-muted">Lade Artikel ...</p>
        </div>
      </main>
    );
  }

  if (state === "error" || !item) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-radar-stroke bg-radar-panel px-5 py-8">
          <p className="text-sm text-radar-muted">Artikel konnte nicht geladen werden.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-radar-stroke px-4 py-2 text-sm font-medium text-radar-ink hover:bg-radar-soft"
          >
            Zurueck zum Feed
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex w-fit rounded-full border border-radar-stroke bg-radar-panel px-4 py-2 text-sm font-medium text-radar-ink hover:bg-radar-soft"
        >
          Zurueck zum Feed
        </Link>
        <ThemeToggle />
      </div>

      <article className="overflow-hidden rounded-2xl border border-radar-stroke bg-radar-panel">
        <div className="relative h-56 w-full sm:h-72">
          <Image
            src={item.imagePath}
            alt={item.imageLabel}
            fill
            className="object-cover"
            sizes="100vw"
            priority
            unoptimized={shouldBypassImageOptimizer(item.imagePath)}
          />
          <div className="absolute left-4 top-4 rounded-full border border-radar-stroke bg-radar-panel px-3 py-1 text-xs font-medium text-radar-ink">
            {item.category}
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-radar-muted">
              Score {item.score}
            </p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl leading-tight text-radar-ink">
              {item.title}
            </h1>
            <p className="mt-2 text-sm text-radar-muted">{formatDate(item.publishedAt)}</p>
          </div>

          <section className="rounded-xl border border-radar-stroke bg-radar-soft p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-radar-muted">
              Kurzfassung
            </h2>
            <p className="mt-2 text-sm text-radar-ink">{item.lead}</p>
            <p className="mt-3 text-sm text-radar-ink">{item.whyItMatters}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-radar-ink">
              Deep Dive
            </h2>
            {item.deepDive.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-radar-ink">
                {paragraph}
              </p>
            ))}
          </section>

          {item.repo ? (
            <RepoAssessmentCard
              repoFullName={item.repo.fullName}
              category={item.category}
              npmPackage={item.repo.npmPackage}
            />
          ) : null}

          {item.commands ? (
            <section className="rounded-xl border border-radar-stroke bg-radar-panel p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-radar-ink">
                Direkt nutzbar
              </h2>
              {item.commands.install ? (
                <p className="mt-2 rounded-lg border border-radar-stroke bg-radar-soft px-3 py-2 font-mono text-xs text-radar-ink">
                  install: {item.commands.install}
                </p>
              ) : null}
              {item.commands.run ? (
                <p className="mt-2 rounded-lg border border-radar-stroke bg-radar-soft px-3 py-2 font-mono text-xs text-radar-ink">
                  run: {item.commands.run}
                </p>
              ) : null}
              {item.commands.docsUrl ? (
                <a
                  href={item.commands.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex rounded-full border border-radar-stroke px-3 py-1.5 text-xs font-medium text-radar-ink hover:bg-radar-soft"
                >
                  Dokumentation oeffnen
                </a>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-radar-stroke bg-radar-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-radar-ink">
              Quelle
            </h2>
            <p className="mt-2 text-sm text-radar-ink">{item.sourceName}</p>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded-full border border-radar-mint bg-radar-mint px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Originalartikel lesen
            </a>
          </section>
        </div>
      </article>
    </main>
  );
}

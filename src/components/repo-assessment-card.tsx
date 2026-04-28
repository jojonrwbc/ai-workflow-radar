"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewsCategory } from "@/lib/feed-data";
import type { RepoAssessment } from "@/lib/repo-assessment";

type RepoAssessmentCardProps = {
  repoFullName: string;
  category: NewsCategory;
  npmPackage?: string;
};

function ScoreScale({ label, value }: { label: string; value: number }) {
  const activeSegments = Math.max(1, Math.round(value));
  const segments = useMemo(() => Array.from({ length: 10 }, (_, idx) => idx), []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-radar-ink">{label}</span>
        <span className="font-mono text-radar-ink">{value.toFixed(1)} / 10</span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {segments.map((segment) => (
          <span
            key={segment}
            className={`h-2 rounded-sm border border-radar-stroke ${
              segment < activeSegments ? "bg-radar-accent" : "bg-radar-soft"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function RepoAssessmentCard({
  repoFullName,
  category,
  npmPackage,
}: RepoAssessmentCardProps) {
  const [assessment, setAssessment] = useState<RepoAssessment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      repo: repoFullName,
      category,
    });

    if (npmPackage) {
      params.set("npmPackage", npmPackage);
    }

    fetch(`/api/repo-assessment?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Bewertung konnte nicht geladen werden.");
        }

        const data = (await response.json()) as RepoAssessment;
        setAssessment(data);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setErrorMessage("Aktuell keine Live-Bewertung verfuegbar.");
      });

    return () => controller.abort();
  }, [repoFullName, category, npmPackage]);

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-radar-stroke bg-radar-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-radar-muted">
          Repo Bewertung
        </h2>
        <p className="mt-2 text-sm text-radar-muted">{errorMessage}</p>
      </section>
    );
  }

  if (!assessment) {
    return (
      <section className="rounded-2xl border border-radar-stroke bg-radar-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-radar-muted">
          Repo Bewertung
        </h2>
        <p className="mt-2 text-sm text-radar-muted">
          Lade tagesaktuelle GitHub-Daten ...
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-radar-stroke bg-radar-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-radar-muted">
            Notwendigkeit und Sicherheit
          </h2>
          <p className="mt-1 text-xs text-radar-muted">{assessment.repoFullName}</p>
        </div>
        <a
          href={assessment.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-radar-stroke bg-radar-soft px-2.5 py-1 text-xs font-medium text-radar-ink hover:bg-radar-accent-soft"
        >
          GitHub
        </a>
      </div>

      <div className="mt-4 space-y-3">
        <ScoreScale label="Funktionalitaet" value={assessment.functionalityScore} />
        <ScoreScale label="Performance" value={assessment.performanceScore} />
        <ScoreScale label="Notwendigkeit" value={assessment.necessityScore} />
        <ScoreScale label="Sicherheit" value={assessment.safetyScore} />
      </div>

      <ul className="mt-4 space-y-1 text-xs text-radar-muted">
        {assessment.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-radar-muted">
        Stand: {new Date(assessment.computedAt).toLocaleString("de-DE")}
      </p>
    </section>
  );
}

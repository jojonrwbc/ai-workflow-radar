import type { NewsCategory } from "@/lib/feed-data";

type GitHubRepoResponse = {
  archived: boolean;
  disabled: boolean;
  forks_count: number;
  stargazers_count: number;
  subscribers_count: number;
  open_issues_count: number;
  pushed_at: string;
  html_url: string;
  license: { key: string } | null;
};

type GitHubReleaseResponse = {
  published_at: string;
  assets: Array<{ download_count: number }>;
};

type NpmDownloadResponse = {
  downloads: number;
};

type AssessmentCacheEntry = {
  expiresAt: number;
  value: RepoAssessment;
};

type CacheStore = Map<string, AssessmentCacheEntry>;

declare global {
  var __repoAssessmentCache: CacheStore | undefined;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const categoryWeight: Record<NewsCategory, number> = {
  MCP: 1.3,
  CLI: 1.15,
  "Open Source": 1.1,
  Workflow: 1.0,
  Benchmark: 0.7,
  "Model Release": 0.5,
};

export type RepoAssessment = {
  repoFullName: string;
  repoUrl: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  releaseDownloads: number;
  npmDownloadsLastWeek: number | null;
  lastPushAt: string;
  lastReleaseAt: string | null;
  functionalityScore: number;
  performanceScore: number;
  necessityScore: number;
  safetyScore: number;
  notes: string[];
  computedAt: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function daysSince(dateIso: string | null) {
  if (!dateIso) return 9999;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / dayMs);
}

function logScale(value: number, maxReference: number) {
  const normalized =
    Math.log10(Math.max(value, 0) + 1) / Math.log10(maxReference + 1);
  return clamp(normalized, 0, 1);
}

function freshnessSignal(days: number) {
  if (days <= 14) return 1;
  if (days <= 45) return 0.84;
  if (days <= 120) return 0.68;
  if (days <= 365) return 0.42;
  return 0.16;
}

function issueHealthSignal(issueRatio: number) {
  if (issueRatio <= 0.02) return 1;
  if (issueRatio <= 0.05) return 0.82;
  if (issueRatio <= 0.1) return 0.62;
  if (issueRatio <= 0.2) return 0.38;
  return 0.16;
}

async function readJson<T>(url: string, headers: HeadersInit): Promise<T | null> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

function getCacheStore(): CacheStore {
  if (!globalThis.__repoAssessmentCache) {
    globalThis.__repoAssessmentCache = new Map<string, AssessmentCacheEntry>();
  }
  return globalThis.__repoAssessmentCache;
}

export async function getRepoAssessment({
  repoFullName,
  category,
  npmPackage,
}: {
  repoFullName: string;
  category: NewsCategory;
  npmPackage?: string;
}): Promise<RepoAssessment | null> {
  const cacheStore = getCacheStore();
  const cacheKey = `${repoFullName}::${category}::${npmPackage ?? ""}`;
  const cached = cacheStore.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-workflow-radar",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const repoUrl = `https://api.github.com/repos/${repoFullName}`;
  const releaseUrl = `https://api.github.com/repos/${repoFullName}/releases/latest`;

  const [repo, latestRelease] = await Promise.all([
    readJson<GitHubRepoResponse>(repoUrl, headers),
    readJson<GitHubReleaseResponse>(releaseUrl, headers),
  ]);

  if (!repo) {
    return null;
  }

  let npmDownloadsLastWeek: number | null = null;
  if (npmPackage) {
    const npmUrl = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(
      npmPackage,
    )}`;
    const npmData = await readJson<NpmDownloadResponse>(npmUrl, {});
    npmDownloadsLastWeek = npmData?.downloads ?? null;
  }

  const releaseDownloads = latestRelease
    ? latestRelease.assets.reduce(
        (total, asset) => total + (asset.download_count ?? 0),
        0,
      )
    : 0;

  const daysFromPush = daysSince(repo.pushed_at);
  const daysFromRelease = daysSince(latestRelease?.published_at ?? null);
  const issueRatio =
    repo.open_issues_count / Math.max(repo.stargazers_count + 120, 1);
  const popularitySignal =
    logScale(repo.stargazers_count, 250000) * 0.65 +
    logScale(repo.forks_count, 50000) * 0.35;
  const adoptionSignal = logScale(
    npmDownloadsLastWeek ?? releaseDownloads,
    2000000,
  );
  const maintenanceSignal = freshnessSignal(daysFromPush);
  const releaseSignal = freshnessSignal(daysFromRelease);
  const qualitySignal = issueHealthSignal(issueRatio);

  const functionalityRaw =
    1 +
    (adoptionSignal * 0.36 +
      maintenanceSignal * 0.28 +
      releaseSignal * 0.22 +
      popularitySignal * 0.14) *
      9;

  const performanceRaw =
    1 +
    (qualitySignal * 0.38 +
      maintenanceSignal * 0.29 +
      releaseSignal * 0.2 +
      adoptionSignal * 0.13) *
      9;

  const functionalityScore = Number(clamp(functionalityRaw, 1, 10).toFixed(1));
  const performanceScore = Number(clamp(performanceRaw, 1, 10).toFixed(1));

  const necessityRaw =
    1 +
    popularitySignal * 2.1 +
    adoptionSignal * 1.8 +
    maintenanceSignal * 1.1 +
    functionalityScore * 0.28 +
    performanceScore * 0.16 +
    categoryWeight[category];

  const safetyRaw =
    1 +
    (repo.archived ? -2.8 : 1.5) +
    (repo.disabled ? -2.5 : 0.8) +
    maintenanceSignal * 2.2 +
    qualitySignal * 2.0 +
    releaseSignal * 1.2 +
    functionalityScore * 0.12 +
    performanceScore * 0.34 +
    (repo.license ? 0.7 : 0.1);

  const necessityScore = Number(clamp(necessityRaw, 1, 10).toFixed(1));
  const safetyScore = Number(clamp(safetyRaw, 1, 10).toFixed(1));

  const notes = [
    `Stars: ${repo.stargazers_count.toLocaleString("de-DE")} | Forks: ${repo.forks_count.toLocaleString("de-DE")} | Watcher: ${repo.subscribers_count.toLocaleString("de-DE")}`,
    `Open Issues: ${repo.open_issues_count.toLocaleString("de-DE")} | Letzter Push: vor ${daysFromPush} Tagen`,
    `Funktionalitaet-Score: ${functionalityScore} | Performance-Score: ${performanceScore}`,
  ];

  if (npmDownloadsLastWeek !== null) {
    notes.push(
      `NPM Downloads (7 Tage): ${npmDownloadsLastWeek.toLocaleString("de-DE")}`,
    );
  } else {
    notes.push(
      `Release Downloads (latest): ${releaseDownloads.toLocaleString("de-DE")}`,
    );
  }

  const result: RepoAssessment = {
    repoFullName,
    repoUrl: repo.html_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count,
    openIssues: repo.open_issues_count,
    releaseDownloads,
    npmDownloadsLastWeek,
    lastPushAt: repo.pushed_at,
    lastReleaseAt: latestRelease?.published_at ?? null,
    functionalityScore,
    performanceScore,
    necessityScore,
    safetyScore,
    notes,
    computedAt: new Date().toISOString(),
  };

  cacheStore.set(cacheKey, {
    expiresAt: Date.now() + ONE_DAY_MS,
    value: result,
  });

  return result;
}

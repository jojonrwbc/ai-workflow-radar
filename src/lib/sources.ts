import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { NewsCategory, NewsItem } from "@/lib/feed-data";
import { isPublicInternetHostname } from "@/lib/network-safety";

type SourceFeed = {
  name: string;
  url: string;
  priorityWeight: number;
};

const BASE_FEEDS: SourceFeed[] = [
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    priorityWeight: 30,
  },
  {
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    priorityWeight: 28,
  },
  {
    name: "Hugging Face Blog",
    url: "https://huggingface.co/blog/feed.xml",
    priorityWeight: 25,
  },
  {
    name: "Hacker News",
    url: "https://hnrss.org/frontpage?count=50",
    priorityWeight: 18,
  },
];

const DEFAULT_REDDIT_SUBREDDITS = [
  "LocalLLaMA",
  "MachineLearning",
  "singularity",
  "OpenAI",
];

const FETCH_TIMEOUT_MS = 8000;
const RELEVANCE_KEYWORDS = [
  "ki",
  "kuenstliche intelligenz",
  "künstliche intelligenz",
  "automatisierung",
  "automation",
  "claude code",
  "openclaw",
  "n8n",
  "jarvis",
  "vibecoding",
  "selfhosted",
  "tutorial",
  "mcp",
  "model context protocol",
  "claude",
  "gpt",
  "gemini",
  "llama",
  "opus",
  "sonnet",
  "haiku",
  "agent",
  "agents",
  "llm",
  "rag",
  "embedding",
  "fine-tune",
  "finetune",
  "tool use",
  "tool calling",
  "function calling",
  "openai",
  "anthropic",
  "deepseek",
  "mistral",
  "huggingface",
  "ollama",
  "vector db",
  "benchmark",
  "eval",
  "swe-bench",
  "humaneval",
];

const MCP_KEYWORDS = ["mcp", "model context protocol"];
const CLI_KEYWORDS = ["cli", "command line", "terminal", "shell"];
const DEV_TOOLING_KEYWORDS = [
  "claude code",
  "cursor",
  "windsurf",
  "copilot",
  "github",
  "gitlab",
  "obsidian",
  "devtools",
  "ide",
  "vscode",
];
const BENCHMARK_KEYWORDS = [
  "benchmark",
  "eval",
  "evaluation",
  "swe-bench",
  "humaneval",
  "leaderboard",
  "rank",
  "score",
];
const RELEASE_KEYWORDS = [
  "release",
  "release notes",
  "launch",
  "launched",
  "announce",
  "announcement",
  "version",
  "changelog",
  "preview",
  "ga",
  "generally available",
  "rolled out",
];
const MODEL_KEYWORDS = [
  "claude",
  "gpt",
  "gemini",
  "llama",
  "mistral",
  "deepseek",
  "model",
  "api",
];
const WORKFLOW_KEYWORDS = [
  "workflow",
  "automation",
  "automatisierung",
  "integration",
  "pipeline",
  "orchestration",
  "agent stack",
  "agent workflow",
  "agent",
  "agents",
  "agentic",
  "multi-agent",
  "n8n",
  "openclaw",
  "paperclip",
  "jarvis",
  "swarmintelligenz",
  "swarm intelligence",
  "make.com",
  "zapier",
];
const OSS_KEYWORDS = [
  "open source",
  "open-source",
  "github",
  "repository",
  "repo",
  "sdk",
  "framework",
  "library",
];
const OSS_INFRA_KEYWORDS = [
  "docker",
  "dockerfile",
  "docker compose",
  "compose.yaml",
  "container",
  "containers",
  "kubernetes",
  "k8s",
  "helm",
  "podman",
  "homeserver",
  "home server",
  "homelab",
  "selfhosted",
  "self-hosted",
  "nas",
  "proxmox",
  "unraid",
  "portainer",
  "traefik",
];
const DUPLICATE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const MIN_DUPLICATE_COMMON_TOKENS = 4;
const MIN_DUPLICATE_OVERLAP = 0.58;
const MIN_DUPLICATE_JACCARD = 0.4;
const DUPLICATE_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "at",
  "with",
  "from",
  "is",
  "are",
  "be",
  "this",
  "that",
  "these",
  "those",
  "new",
  "latest",
  "update",
  "news",
  "about",
  "into",
  "over",
  "under",
  "de",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einer",
  "einem",
  "und",
  "oder",
  "mit",
  "fuer",
  "für",
  "von",
  "auf",
  "bei",
  "den",
  "dem",
  "des",
  "im",
  "zu",
  "zur",
  "zum",
  "ist",
  "sind",
  "nicht",
  "mehr",
]);
const GERMAN_PRIORITY_SOURCE_NAMES = new Set([
  "julian ivanov",
  "ichbinfabian",
  "christoph magnussen",
  "ct3003",
  "niklas hansen",
  "the morpheus",
  "morpheus",
  "heise",
  "golem.de",
]);
const GERMAN_SIGNAL_KEYWORDS = [
  " der ",
  " die ",
  " das ",
  " und ",
  " fuer ",
  " für ",
  " mit ",
  " ohne ",
  "nicht",
  "neues",
  "neuer",
  "ankuendigung",
  "ankündigung",
  "veroeffentlicht",
  "veröffentlicht",
  "deutsch",
  "deutscher",
  "deutsche",
  "kuenstliche intelligenz",
  "künstliche intelligenz",
];

type RawFeedItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  sourceName: string;
  priorityWeight: number;
};

function hashId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function coverImagePath(title: string, sourceName: string, category: NewsCategory): string {
  const params = new URLSearchParams({
    title: title.slice(0, 120),
    source: sourceName.slice(0, 80),
    category,
  });
  return `/api/cover-image?${params.toString()}`;
}

function includesAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keywordMatches(haystack, keyword));
}

function keywordMatches(haystack: string, keyword: string): boolean {
  if (keyword.length <= 5) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    return regex.test(haystack);
  }
  return haystack.includes(keyword);
}

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseNamedEntry(input: string): { name: string | null; value: string } {
  const separatorIndex = input.indexOf("|");
  if (separatorIndex <= 0) {
    return { name: null, value: input.trim() };
  }

  const name = input.slice(0, separatorIndex).trim();
  const value = input.slice(separatorIndex + 1).trim();
  return {
    name: name.length > 0 ? name : null,
    value,
  };
}

export function normalizeRedditFeed(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const withoutPrefix = value.replace(/^r\//i, "").trim();
  return `https://www.reddit.com/r/${encodeURIComponent(withoutPrefix)}/.rss`;
}

function normalizeYouTubeFeedFromChannelId(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function normalizeYouTubeFeedFromUsername(username: string): string {
  return `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(username)}`;
}

function extractYouTubeHandle(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) {
    return trimmed.slice(1);
  }

  try {
    const parsed = new URL(trimmed);
    const handleMatch = parsed.pathname.match(/^\/@([^/]+)$/);
    if (handleMatch?.[1]) {
      return handleMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function extractYouTubeChannelId(html: string): string | null {
  const metaMatch =
    html.match(
      /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[\w-]{22})["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["'](UC[\w-]{22})["'][^>]+itemprop=["']channelId["']/i,
    );
  if (metaMatch?.[1]) {
    return metaMatch[1];
  }

  const jsonMatch = html.match(/"channelId":"(UC[\w-]{22})"/i);
  if (jsonMatch?.[1]) {
    return jsonMatch[1];
  }

  const browseMatch = html.match(/"browseId":"(UC[\w-]{22})"/i);
  if (browseMatch?.[1]) {
    return browseMatch[1];
  }

  return null;
}

async function resolveYouTubeChannelIdFromUrl(urlValue: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    return null;
  }

  const isYouTubeHost =
    parsed.hostname.endsWith("youtube.com") || parsed.hostname === "youtu.be";
  if (!isYouTubeHost) {
    return null;
  }

  const allowed = await isPublicInternetHostname(parsed.hostname);
  if (!allowed) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "hook-ai/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractYouTubeChannelId(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function normalizeYouTubeFeed(value: string): Promise<string | null> {
  if (!value) {
    return null;
  }

  if (/^UC[\w-]{22}$/.test(value)) {
    return normalizeYouTubeFeedFromChannelId(value);
  }

  if (/^https?:\/\/www\.youtube\.com\/feeds\/videos\.xml/i.test(value)) {
    return value;
  }

  const asUrl = /^https?:\/\//i.test(value)
    ? value
    : `https://www.youtube.com/${value.startsWith("@") ? value : `@${value}`}`;
  const channelId = await resolveYouTubeChannelIdFromUrl(asUrl);
  if (channelId) {
    return normalizeYouTubeFeedFromChannelId(channelId);
  }

  const handle = extractYouTubeHandle(value) ?? extractYouTubeHandle(asUrl);
  if (handle) {
    return normalizeYouTubeFeedFromUsername(handle);
  }

  return null;
}

async function getConfiguredFeeds(): Promise<SourceFeed[]> {
  const feeds: SourceFeed[] = [...BASE_FEEDS];
  const seenUrls = new Set(feeds.map((feed) => feed.url));

  const enableReddit = parseBoolEnv(process.env.HOOKAI_ENABLE_REDDIT, true);
  if (enableReddit) {
    const subredditEntries = parseCsvEnv(process.env.HOOKAI_REDDIT_SUBREDDITS);
    const explicitRedditFeeds = parseCsvEnv(process.env.HOOKAI_REDDIT_FEEDS);
    const subreddits =
      subredditEntries.length > 0 ? subredditEntries : DEFAULT_REDDIT_SUBREDDITS;

    const redditFeedUrls = [
      ...subreddits.map(normalizeRedditFeed),
      ...explicitRedditFeeds.map(normalizeRedditFeed),
    ];

    for (const feedUrl of redditFeedUrls) {
      if (seenUrls.has(feedUrl)) continue;
      seenUrls.add(feedUrl);
      feeds.push({
        name: "Reddit AI",
        url: feedUrl,
        priorityWeight: 16,
      });
    }
  }

  const enableYoutube = parseBoolEnv(process.env.HOOKAI_ENABLE_YOUTUBE, true);
  if (enableYoutube) {
    const channelEntries = parseCsvEnv(process.env.HOOKAI_YOUTUBE_CHANNELS);
    const explicitFeedEntries = parseCsvEnv(process.env.HOOKAI_YOUTUBE_FEEDS);
    const youtubeEntries = [...channelEntries, ...explicitFeedEntries];

    const normalized = await Promise.all(
      youtubeEntries.map(async (entry) => {
        const { name, value } = parseNamedEntry(entry);
        const feedUrl = await normalizeYouTubeFeed(value);
        if (!feedUrl) return null;
        return {
          name: name ?? "YouTube AI",
          url: feedUrl,
          priorityWeight: 20,
        } satisfies SourceFeed;
      }),
    );

    for (const feed of normalized) {
      if (!feed) continue;
      if (seenUrls.has(feed.url)) continue;
      seenUrls.add(feed.url);
      feeds.push(feed);
    }
  }

  return feeds;
}

async function fetchFeedAttempt(feed: SourceFeed): Promise<{
  ok: boolean;
  retriable: boolean;
  body?: string;
}> {
  const url = new URL(feed.url);
  const allowed = await isPublicInternetHostname(url.hostname);
  if (!allowed) return { ok: false, retriable: false };
  const userAgent = url.hostname.includes("reddit.com")
    ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    : "hook-ai/1.0";
  const requestCache = url.hostname.includes("reddit.com")
    ? undefined
    : "no-store";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
      },
      redirect: "follow",
      cache: requestCache,
    });

    if (!response.ok) {
      console.error(`[sources] ${feed.name} HTTP ${response.status}`);
      return { ok: false, retriable: response.status >= 500 };
    }

    return { ok: true, retriable: false, body: await response.text() };
  } catch (err) {
    console.error(`[sources] ${feed.name} fetch failed:`, err);
    return { ok: false, retriable: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFeedXml(feed: SourceFeed): Promise<string | null> {
  const first = await fetchFeedAttempt(feed);
  if (first.ok) return first.body ?? null;
  if (!first.retriable) return null;

  await new Promise((resolve) => setTimeout(resolve, 500));
  const retry = await fetchFeedAttempt(feed);
  return retry.ok ? retry.body ?? null : null;
}

function extractLink(link: unknown): string {
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const candidate = link.find((entry) => {
      if (typeof entry === "string") return true;
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        const rel = obj["@_rel"];
        return rel === undefined || rel === "alternate";
      }
      return false;
    });
    return extractLink(candidate);
  }
  if (link && typeof link === "object") {
    const obj = link as Record<string, unknown>;
    const href = obj["@_href"];
    if (typeof href === "string") return href;
    const text = obj["#text"];
    if (typeof text === "string") return text;
  }
  return "";
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const text = obj["#text"];
    if (typeof text === "string") return text;
  }
  return "";
}

function parseFeed(xml: string, feed: SourceFeed): RawFeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    console.error(`[sources] ${feed.name} parse failed:`, err);
    return [];
  }

  const root = parsed as Record<string, unknown>;
  const rss = root.rss as Record<string, unknown> | undefined;
  const atom = root.feed as Record<string, unknown> | undefined;

  if (rss?.channel) {
    const channel = rss.channel as Record<string, unknown>;
    const itemsRaw = channel.item;
    const items = Array.isArray(itemsRaw) ? itemsRaw : itemsRaw ? [itemsRaw] : [];
    return items.map((entry) => {
      const obj = entry as Record<string, unknown>;
      return {
        title: extractText(obj.title),
        link: extractLink(obj.link),
        description: extractText(obj.description),
        publishedAt: extractText(obj.pubDate) || extractText(obj["dc:date"]),
        sourceName: feed.name,
        priorityWeight: feed.priorityWeight,
      };
    });
  }

  if (atom) {
    const entriesRaw = atom.entry;
    const entries = Array.isArray(entriesRaw)
      ? entriesRaw
      : entriesRaw
        ? [entriesRaw]
        : [];
    return entries.map((entry) => {
      const obj = entry as Record<string, unknown>;
      return {
        title: extractText(obj.title),
        link: extractLink(obj.link),
        description:
          extractText(obj.summary) || extractText(obj.content),
        publishedAt: extractText(obj.updated) || extractText(obj.published),
        sourceName: feed.name,
        priorityWeight: feed.priorityWeight,
      };
    });
  }

  return [];
}

export function categorize(title: string, lead: string): NewsCategory {
  const hay = `${title} ${lead}`.toLowerCase();

  if (includesAny(hay, MCP_KEYWORDS)) return "MCP";
  if (includesAny(hay, RELEASE_KEYWORDS) && includesAny(hay, MODEL_KEYWORDS)) {
    return "Model Release";
  }
  if (includesAny(hay, CLI_KEYWORDS) || includesAny(hay, DEV_TOOLING_KEYWORDS)) {
    return "CLI";
  }
  if (includesAny(hay, OSS_INFRA_KEYWORDS)) return "Open Source Infra";
  if (includesAny(hay, WORKFLOW_KEYWORDS)) return "Workflow";
  if (includesAny(hay, BENCHMARK_KEYWORDS)) return "Benchmark";
  if (includesAny(hay, OSS_KEYWORDS)) return "Open Source";
  return "Open Source";
}

export function isRelevant(title: string, lead: string): boolean {
  const hay = `${title} ${lead}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((keyword) => keywordMatches(hay, keyword));
}

export function recencyScore(publishedAt: string): number {
  const ts = new Date(publishedAt).getTime();
  if (Number.isNaN(ts)) return 10;
  const dayMs = 24 * 60 * 60 * 1000;
  const days = (Date.now() - ts) / dayMs;
  if (days <= 1) return 40;
  if (days <= 3) return 32;
  if (days <= 7) return 22;
  if (days <= 14) return 12;
  if (days <= 30) return 6;
  return 2;
}

export function keywordScore(title: string, lead: string): number {
  const hay = `${title} ${lead}`.toLowerCase();
  let hits = 0;
  for (const keyword of RELEVANCE_KEYWORDS) {
    if (keywordMatches(hay, keyword)) hits += 1;
  }
  return clamp(hits * 6, 0, 30);
}

export function germanPriorityScore(
  title: string,
  lead: string,
  sourceName: string,
): number {
  const hay = ` ${title} ${lead} `.toLowerCase();
  const source = sourceName.toLowerCase().trim();
  const sourceBoost = GERMAN_PRIORITY_SOURCE_NAMES.has(source) ? 6 : 0;
  const umlautBoost = /[äöüß]/i.test(`${title} ${lead}`) ? 2 : 0;

  let signalHits = 0;
  for (const keyword of GERMAN_SIGNAL_KEYWORDS) {
    if (hay.includes(keyword)) signalHits += 1;
  }
  const keywordBoost = clamp(signalHits * 2, 0, 6);
  return clamp(sourceBoost + umlautBoost + keywordBoost, 0, 12);
}

function audienceHint(category: NewsCategory): string {
  switch (category) {
    case "MCP":
      return "Teams, die Agenten mit externen Tools und Datenquellen verbinden.";
    case "CLI":
      return "Builder, die mit Terminal-, CI/CD- und Repo-Workflows arbeiten.";
    case "Workflow":
      return "Ops- und Produktteams, die wiederholbare KI-Automationen aufsetzen.";
    case "Open Source Infra":
      return "Self-hosting- und Plattform-Teams mit Docker, Containern und Homelab/Server-Setups.";
    case "Model Release":
      return "Produktverantwortliche, die Modellwechsel, Qualität und Kosten steuern.";
    case "Benchmark":
      return "Entscheider, die Modell- oder Tool-Wahl über Metriken absichern müssen.";
    case "Open Source":
    default:
      return "Developer und AI-Teams, die Open-Source-Tools produktiv evaluieren.";
  }
}

function prerequisitesHint(category: NewsCategory): string {
  switch (category) {
    case "MCP":
      return "Voraussetzungen: API-Zugänge, sauber definierte Tool-Schnittstellen und ein kontrolliertes Berechtigungsmodell.";
    case "CLI":
      return "Voraussetzungen: reproduzierbare lokale Umgebung, funktionierende CI-Pipeline und Basis-Scripting im Team.";
    case "Workflow":
      return "Voraussetzungen: klare Prozessgrenzen, Trigger/Events und Monitoring fuer Fehlschlaege oder Drift.";
    case "Open Source Infra":
      return "Voraussetzungen: Container-Basiswissen, Secret-Handling, Backups, Healthchecks und Update-Prozess.";
    case "Model Release":
      return "Voraussetzungen: Eval-Set, Rollout-Plan, Guardrails fuer Regression und observability pro Modell.";
    case "Benchmark":
      return "Voraussetzungen: stabile Testdaten, gleiche Prompt- und Tool-Bedingungen und regelmaessige Re-Runs.";
    case "Open Source":
    default:
      return "Voraussetzungen: PoC-Umgebung, technischer Owner und klare Akzeptanzkriterien vor produktivem Einsatz.";
  }
}

function costHint(category: NewsCategory): string {
  switch (category) {
    case "Open Source Infra":
      return "Kostenprofil: meist niedrigere Lizenzkosten, aber hoeherer Betriebsaufwand fuer Hosting, Wartung und Security.";
    case "Model Release":
      return "Kostenprofil: Token-/API-Kosten, mögliche Migrationskosten und QA-Aufwand beim Modellwechsel.";
    case "Workflow":
      return "Kostenprofil: vor allem Integrations- und Pflegeaufwand, dafuer oft deutliche Zeitersparnis im Betrieb.";
    case "Benchmark":
      return "Kostenprofil: Auswertung kostet initial Zeit, spart aber Fehlentscheidungen bei Tool- und Modellwahl.";
    case "MCP":
      return "Kostenprofil: Integrationsaufwand am Anfang, danach hoher Hebel durch wiederverwendbare Tool-Verbindungen.";
    case "CLI":
      return "Kostenprofil: sehr guter ROI, da kleine CLI-Automationen schnell manuelle Routinearbeit reduzieren.";
    case "Open Source":
    default:
      return "Kostenprofil: oft schneller Einstieg, aber langfristig Aufwand fuer Updates, Security und Ownership einplanen.";
  }
}

function actionHint(category: NewsCategory): string {
  switch (category) {
    case "Model Release":
      return "Naechster Schritt: 1-2 kritische Use-Cases als A/B-Test gegen das aktuell genutzte Modell benchmarken und dann schrittweise ausrollen.";
    case "Open Source Infra":
      return "Naechster Schritt: zuerst einen isolierten Staging-Container aufsetzen, mit Load- und Recovery-Test vor produktivem Rollout.";
    case "MCP":
      return "Naechster Schritt: einen engen Pilot-Flow (ein Tool, ein Task, ein Erfolgskriterium) aufsetzen und Telemetrie mitlaufen lassen.";
    case "CLI":
      return "Naechster Schritt: den Prozess in ein reproduzierbares Script + CI-Check giessen, damit das Team den Flow sofort teilen kann.";
    case "Workflow":
      return "Naechster Schritt: mit einem einzelnen, messbaren Automations-Case starten und Fehlertoleranz (Retry/Fallback) einbauen.";
    case "Benchmark":
      return "Naechster Schritt: die Metrik auf euren Real-Case mappen und nur Entscheidungen treffen, die auch im eigenen Datensatz tragen.";
    case "Open Source":
    default:
      return "Naechster Schritt: einen 1-2 Wochen PoC mit klarer Abbruchbedingung und dokumentierten Learnings fahren.";
  }
}

function buildDeepDive(
  raw: RawFeedItem,
  category: NewsCategory,
  lead: string,
  score: number,
): string[] {
  const categoryLabel = category.toLowerCase();
  return [
    `${lead} Diese Meldung ist im Stream "${category}" einsortiert und liefert ein ${categoryLabel}-Signal mit direktem Bezug zu operativen Entscheidungen.`,
    `Fuer wen relevant: ${audienceHint(category)} Besonders sinnvoll ist das Thema, wenn ihr gerade Entscheidungen zu Toolchain, Agent-Qualitaet oder Integrationsgeschwindigkeit treffen muesst.`,
    `Konkreter Usecase: Nutzt den Impuls, um einen kleinen, realen Team-Workflow zu verbessern (z. B. schnellere PR-Checks, stabilere Agent-Runs, bessere Retrieval-Qualitaet oder reproduzierbare Deployments). Der aktuelle Relevanz-Score liegt bei ${score}.`,
    prerequisitesHint(category),
    costHint(category),
    `Benefit-Erwartung: Quelle ${raw.sourceName} deutet auf kurzfristig nutzbare Verbesserungen hin. Bei sauberem Rollout sind typische Effekte weniger manuelle Schritte, bessere Fehlersichtbarkeit und schnellere Entscheidungszyklen.`,
    actionHint(category),
  ];
}

function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9äöüß\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupTokens(item: NewsItem): Set<string> {
  const hay = normalizeForDedup(`${item.title} ${item.lead}`);
  const tokens = hay
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !DUPLICATE_STOP_WORDS.has(token));
  return new Set(tokens);
}

function countIntersection(a: Set<string>, b: Set<string>): number {
  let common = 0;
  for (const token of a) {
    if (b.has(token)) common += 1;
  }
  return common;
}

function publishedAtMs(value: string): number {
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? Date.now() : ts;
}

function isNearDuplicate(a: NewsItem, b: NewsItem): boolean {
  const normalizedTitleA = normalizeForDedup(a.title);
  const normalizedTitleB = normalizeForDedup(b.title);
  if (normalizedTitleA.length > 0 && normalizedTitleA === normalizedTitleB) {
    return true;
  }

  const deltaMs = Math.abs(publishedAtMs(a.publishedAt) - publishedAtMs(b.publishedAt));
  if (deltaMs > DUPLICATE_WINDOW_MS) {
    return false;
  }

  const tokensA = dedupTokens(a);
  const tokensB = dedupTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return false;
  }

  const common = countIntersection(tokensA, tokensB);
  if (common < MIN_DUPLICATE_COMMON_TOKENS) {
    const releaseLike =
      includesAny(normalizedTitleA, RELEASE_KEYWORDS) &&
      includesAny(normalizedTitleB, RELEASE_KEYWORDS);
    const modelLike =
      includesAny(normalizedTitleA, MODEL_KEYWORDS) &&
      includesAny(normalizedTitleB, MODEL_KEYWORDS);
    if (!(releaseLike && modelLike && common >= 3)) {
      return false;
    }
  }

  if (common < 3) {
    return false;
  }

  const overlap = common / Math.min(tokensA.size, tokensB.size);
  const union = tokensA.size + tokensB.size - common;
  const jaccard = union <= 0 ? 0 : common / union;

  return overlap >= MIN_DUPLICATE_OVERLAP || jaccard >= MIN_DUPLICATE_JACCARD;
}

export function dedupeSimilarItems(items: NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return publishedAtMs(b.publishedAt) - publishedAtMs(a.publishedAt);
  });

  const deduped: NewsItem[] = [];
  for (const candidate of sorted) {
    const exists = deduped.some((kept) => isNearDuplicate(candidate, kept));
    if (!exists) {
      deduped.push(candidate);
    }
  }

  return deduped;
}

export type SourceCollectionStats = {
  feedsUsed: number;
  rawItemsFetched: number;
  relevantItemsBuilt: number;
  uniqueByUrlItems: number;
  dedupedItems: number;
  duplicatesRemoved: number;
};

export type SourceCollectionReport = {
  items: NewsItem[];
  stats: SourceCollectionStats;
};

function buildNewsItem(raw: RawFeedItem): NewsItem | null {
  const title = stripHtml(raw.title);
  const lead = stripHtml(raw.description).slice(0, 320);
  if (!title || !raw.link) return null;
  if (!isRelevant(title, lead)) return null;

  const category = categorize(title, lead);
  const recency = recencyScore(raw.publishedAt);
  const keywords = keywordScore(title, lead);
  const germanPriority = germanPriorityScore(title, lead, raw.sourceName);
  const score = clamp(recency + keywords + raw.priorityWeight + germanPriority, 0, 100);

  const ts = new Date(raw.publishedAt).getTime();
  const publishedAtIso = Number.isNaN(ts)
    ? new Date().toISOString()
    : new Date(ts).toISOString();

  const novelty = clamp(Math.round((recency / 40) * 100), 0, 100);
  const signal = clamp(Math.round((keywords / 30) * 100), 0, 100);
  const obscurity = clamp(100 - raw.priorityWeight * 3, 0, 100);
  const deepDive = buildDeepDive(raw, category, lead || title, score);

  return {
    id: hashId(raw.link),
    title,
    lead: lead || title,
    whyItMatters: `Quelle ${raw.sourceName} — starkes ${category}-Signal fuer umsetzbare Entscheidungen.`,
    sourceName: raw.sourceName,
    sourceUrl: raw.link,
    imageLabel: `${category} Quelle`,
    imagePath: coverImagePath(title, raw.sourceName, category),
    publishedAt: publishedAtIso,
    category,
    score,
    novelty,
    workflowFit: clamp(
      60 +
        (category === "Workflow" ? 20 : 0) +
        (category === "Open Source Infra" ? 12 : 0),
      0,
      100,
    ),
    signal,
    obscurity,
    saved: false,
    deepDive,
  };
}

export async function collectFromSourcesReport(): Promise<SourceCollectionReport> {
  const feeds = await getConfiguredFeeds();
  const settled = await Promise.allSettled(feeds.map((feed) => fetchFeedXml(feed)));
  const rawItems: RawFeedItem[] = [];
  for (let i = 0; i < feeds.length; i += 1) {
    const result = settled[i];
    if (result.status === "rejected") {
      console.error(`[sources] ${feeds[i].name} unhandled rejection:`, result.reason);
      continue;
    }
    const xml = result.value;
    if (!xml) continue;
    rawItems.push(...parseFeed(xml, feeds[i]));
  }

  const items: NewsItem[] = [];
  const seenIds = new Set<string>();
  for (const raw of rawItems) {
    const built = buildNewsItem(raw);
    if (!built) continue;
    if (seenIds.has(built.id)) continue;
    seenIds.add(built.id);
    items.push(built);
  }

  const dedupedItems = dedupeSimilarItems(items);
  return {
    items: dedupedItems,
    stats: {
      feedsUsed: feeds.length,
      rawItemsFetched: rawItems.length,
      relevantItemsBuilt: items.length,
      uniqueByUrlItems: items.length,
      dedupedItems: dedupedItems.length,
      duplicatesRemoved: Math.max(0, items.length - dedupedItems.length),
    },
  };
}

export async function collectFromSources(): Promise<NewsItem[]> {
  const report = await collectFromSourcesReport();
  return report.items;
}

import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { NewsCategory, NewsItem } from "@/lib/feed-data";
import { isPublicInternetHostname } from "@/lib/network-safety";

type SourceFeed = {
  name: string;
  url: string;
  priorityWeight: number;
};

const FEEDS: SourceFeed[] = [
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

const FETCH_TIMEOUT_MS = 8000;
const RELEVANCE_KEYWORDS = [
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

const CATEGORY_IMAGES: Record<NewsCategory, string> = {
  MCP: "/thumbnails/mcp-registry.svg",
  CLI: "/thumbnails/cli-release.svg",
  "Open Source": "/thumbnails/open-eval.svg",
  "Model Release": "/thumbnails/model-notes.svg",
  Benchmark: "/thumbnails/benchmark-shift.svg",
  Workflow: "/thumbnails/open-eval.svg",
};

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

async function fetchFeedXml(feed: SourceFeed): Promise<string | null> {
  try {
    const url = new URL(feed.url);
    const allowed = await isPublicInternetHostname(url.hostname);
    if (!allowed) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ai-workflow-radar/1.0",
        Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml",
      },
      redirect: "follow",
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.error(`[sources] ${feed.name} HTTP ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (err) {
    console.error(`[sources] ${feed.name} fetch failed:`, err);
    return null;
  }
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

function categorize(title: string, lead: string): NewsCategory {
  const hay = `${title} ${lead}`.toLowerCase();

  if (/\b(mcp|model context protocol)\b/.test(hay)) return "MCP";
  if (/\b(cli|command line|terminal|shell)\b/.test(hay)) return "CLI";
  if (
    /\b(release|launch|announce|version|changelog)\b/.test(hay) &&
    /\b(claude|gpt|gemini|llama|opus|sonnet|haiku|model)\b/.test(hay)
  ) {
    return "Model Release";
  }
  if (/\b(benchmark|eval|swe-bench|humaneval|leaderboard|score)\b/.test(hay)) {
    return "Benchmark";
  }
  if (/\b(workflow|automation|integration|pipeline)\b/.test(hay)) return "Workflow";
  return "Open Source";
}

function isRelevant(title: string, lead: string): boolean {
  const hay = `${title} ${lead}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((keyword) => hay.includes(keyword));
}

function recencyScore(publishedAt: string): number {
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

function keywordScore(title: string, lead: string): number {
  const hay = `${title} ${lead}`.toLowerCase();
  let hits = 0;
  for (const keyword of RELEVANCE_KEYWORDS) {
    if (hay.includes(keyword)) hits += 1;
  }
  return clamp(hits * 6, 0, 30);
}

function buildNewsItem(raw: RawFeedItem): NewsItem | null {
  const title = stripHtml(raw.title);
  const lead = stripHtml(raw.description).slice(0, 320);
  if (!title || !raw.link) return null;
  if (!isRelevant(title, lead)) return null;

  const category = categorize(title, lead);
  const recency = recencyScore(raw.publishedAt);
  const keywords = keywordScore(title, lead);
  const score = clamp(recency + keywords + raw.priorityWeight, 0, 100);

  const ts = new Date(raw.publishedAt).getTime();
  const publishedAtIso = Number.isNaN(ts)
    ? new Date().toISOString()
    : new Date(ts).toISOString();

  const novelty = clamp(Math.round((recency / 40) * 100), 0, 100);
  const signal = clamp(Math.round((keywords / 30) * 100), 0, 100);
  const obscurity = clamp(100 - raw.priorityWeight * 3, 0, 100);

  return {
    id: hashId(raw.link),
    title,
    lead: lead || title,
    whyItMatters: `Quelle ${raw.sourceName} — relevant fuer ${category}.`,
    sourceName: raw.sourceName,
    sourceUrl: raw.link,
    imageLabel: `${category} Quelle`,
    imagePath: CATEGORY_IMAGES[category],
    publishedAt: publishedAtIso,
    category,
    score,
    novelty,
    workflowFit: clamp(60 + (category === "Workflow" ? 20 : 0), 0, 100),
    signal,
    obscurity,
    saved: false,
    deepDive: lead ? [lead] : [title],
  };
}

export async function collectFromSources(): Promise<NewsItem[]> {
  const xmls = await Promise.all(FEEDS.map((feed) => fetchFeedXml(feed)));
  const rawItems: RawFeedItem[] = [];
  for (let i = 0; i < FEEDS.length; i += 1) {
    const xml = xmls[i];
    if (!xml) continue;
    rawItems.push(...parseFeed(xml, FEEDS[i]));
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

  return items;
}

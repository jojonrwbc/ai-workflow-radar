import { describe, expect, it } from "vitest";
import {
  categorize,
  dedupeSimilarItems,
  extractYouTubeChannelId,
  germanPriorityScore,
  isRelevant,
  keywordScore,
  normalizeRedditFeed,
  recencyScore,
} from "./sources";
import type { NewsItem } from "./feed-data";

describe("categorize", () => {
  it("detects MCP", () => {
    expect(categorize("New MCP server", "release")).toBe("MCP");
    expect(categorize("Model Context Protocol update", "")).toBe("MCP");
  });

  it("detects CLI", () => {
    expect(categorize("Claude Code CLI", "terminal tool")).toBe("CLI");
  });

  it("detects Open Source Infra", () => {
    expect(
      categorize("Docker compose for local AI agents", "homelab setup with container"),
    ).toBe("Open Source Infra");
  });

  it("detects Model Release", () => {
    expect(categorize("Claude Sonnet 5 launch", "release announcement")).toBe(
      "Model Release",
    );
  });

  it("detects Benchmark", () => {
    expect(categorize("New SWE-bench score", "leaderboard")).toBe("Benchmark");
  });

  it("detects Workflow", () => {
    expect(categorize("Automation pipeline", "integration workflow")).toBe(
      "Workflow",
    );
  });

  it("detects Workflow from creator-style agent topics", () => {
    expect(categorize("Hermes Agent mit n8n", "OpenClaw workflow setup")).toBe(
      "Workflow",
    );
  });

  it("detects CLI from developer-tooling topics", () => {
    expect(categorize("Claude Code Best Practices", "Obsidian + Cursor")).toBe(
      "CLI",
    );
  });

  it("falls back to Open Source", () => {
    expect(categorize("Random LLM news", "research updates")).toBe("Open Source");
  });
});

describe("isRelevant", () => {
  it("matches keyword in title", () => {
    expect(isRelevant("OpenAI launches GPT-5", "")).toBe(true);
  });

  it("matches keyword in lead", () => {
    expect(isRelevant("Random title", "uses MCP under the hood")).toBe(true);
  });

  it("rejects unrelated content", () => {
    expect(isRelevant("Cooking recipe", "stir well")).toBe(false);
  });

  it("matches german AI terms", () => {
    expect(isRelevant("KI Automatisierung mit Claude Code", "")).toBe(true);
  });
});

describe("recencyScore", () => {
  it("scores fresh items high", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(recencyScore(recent)).toBe(40);
  });

  it("scores week-old items mid", () => {
    const sevenDays = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(recencyScore(sevenDays)).toBe(22);
  });

  it("scores ancient items low", () => {
    const old = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(recencyScore(old)).toBe(2);
  });

  it("returns fallback for invalid date", () => {
    expect(recencyScore("not a date")).toBe(10);
  });
});

describe("keywordScore", () => {
  it("counts keyword hits clamped to 30", () => {
    expect(keywordScore("Claude GPT Gemini", "agent llm rag")).toBe(30);
  });

  it("returns 0 when nothing matches", () => {
    expect(keywordScore("hello", "world")).toBe(0);
  });

  it("scales linearly until clamp", () => {
    expect(keywordScore("Claude release", "")).toBe(6);
    expect(keywordScore("Claude GPT release", "")).toBe(12);
  });
});

describe("germanPriorityScore", () => {
  it("boosts configured german creator sources", () => {
    expect(
      germanPriorityScore(
        "Claude Code Best Practices",
        "workflow update",
        "Julian Ivanov",
      ),
    ).toBeGreaterThan(0);
  });

  it("boosts german language text signals", () => {
    expect(
      germanPriorityScore(
        "Neue KI Ankuendigung",
        "deutsche Automatisierung mit OpenClaw",
        "Some Source",
      ),
    ).toBeGreaterThan(0);
  });

  it("does not boost neutral english content", () => {
    expect(
      germanPriorityScore(
        "OpenAI launches new API",
        "model release notes and benchmark details",
        "OpenAI News",
      ),
    ).toBe(0);
  });
});

describe("normalizeRedditFeed", () => {
  it("builds feed URL from subreddit name", () => {
    expect(normalizeRedditFeed("LocalLLaMA")).toBe(
      "https://www.reddit.com/r/LocalLLaMA/.rss",
    );
  });

  it("keeps explicit URL", () => {
    const url = "https://www.reddit.com/r/MachineLearning/new/.rss?limit=25";
    expect(normalizeRedditFeed(url)).toBe(url);
  });
});

describe("extractYouTubeChannelId", () => {
  it("extracts from channel meta tag", () => {
    const html =
      '<meta itemprop="channelId" content="UCBJycsmduvYEL83R_U4JriQ">';
    expect(extractYouTubeChannelId(html)).toBe("UCBJycsmduvYEL83R_U4JriQ");
  });

  it("extracts from JSON payload", () => {
    const html = '{"channelId":"UCX6b17PVsYBQ0ip5gyeme-Q"}';
    expect(extractYouTubeChannelId(html)).toBe("UCX6b17PVsYBQ0ip5gyeme-Q");
  });

  it("extracts from browseId payload", () => {
    const html = '{"browseId":"UC2ojq-nuP8ceeHqiroeKhBA"}';
    expect(extractYouTubeChannelId(html)).toBe("UC2ojq-nuP8ceeHqiroeKhBA");
  });
});

function makeItem(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: "id-1",
    title: "Base title",
    lead: "Base lead",
    whyItMatters: "why",
    sourceName: "source",
    sourceUrl: "https://example.com/a",
    imageLabel: "img",
    imagePath: "/thumbnails/open-eval.svg",
    publishedAt: "2026-04-29T00:00:00.000Z",
    category: "Open Source",
    score: 70,
    novelty: 70,
    workflowFit: 70,
    signal: 70,
    obscurity: 70,
    saved: false,
    deepDive: ["x"],
    ...overrides,
  };
}

describe("dedupeSimilarItems", () => {
  it("keeps only highest scored item for near-duplicate stories", () => {
    const items = [
      makeItem({
        id: "a",
        score: 91,
        sourceUrl: "https://youtube.com/watch?v=111",
        title: "OpenAI releases new GPT-5 API with tool calling improvements",
        lead: "New GPT-5 API release improves tool calling reliability and latency.",
      }),
      makeItem({
        id: "b",
        score: 83,
        sourceUrl: "https://youtube.com/watch?v=222",
        title: "GPT-5 API launch: better tool calling and lower latency",
        lead: "OpenAI announces GPT-5 API with improved reliability in tool calls.",
      }),
    ];

    const deduped = dedupeSimilarItems(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("a");
  });

  it("keeps distinct stories", () => {
    const items = [
      makeItem({
        id: "a",
        score: 88,
        sourceUrl: "https://example.com/a",
        title: "MCP server registry adds new filesystem bridge",
        lead: "Several MCP integrations arrived today.",
      }),
      makeItem({
        id: "b",
        score: 84,
        sourceUrl: "https://example.com/b",
        title: "Reddit discusses Gemini memory safety benchmark",
        lead: "Community analysis of benchmark methodology.",
      }),
    ];

    const deduped = dedupeSimilarItems(items);
    expect(deduped).toHaveLength(2);
  });
});

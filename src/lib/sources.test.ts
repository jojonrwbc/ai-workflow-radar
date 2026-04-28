import { describe, expect, it } from "vitest";
import {
  categorize,
  isRelevant,
  keywordScore,
  recencyScore,
} from "./sources";

describe("categorize", () => {
  it("detects MCP", () => {
    expect(categorize("New MCP server", "release")).toBe("MCP");
    expect(categorize("Model Context Protocol update", "")).toBe("MCP");
  });

  it("detects CLI", () => {
    expect(categorize("Claude Code CLI", "terminal tool")).toBe("CLI");
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

  it("falls back to Open Source", () => {
    expect(categorize("Random LLM news", "agent updates")).toBe("Open Source");
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

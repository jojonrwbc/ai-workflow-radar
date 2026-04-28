import { NextRequest, NextResponse } from "next/server";
import type { NewsCategory } from "@/lib/feed-data";
import { getRepoAssessment } from "@/lib/repo-assessment";

const REPO_FULLNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,38})\/[A-Za-z0-9_.-]{1,100}$/;
const NPM_PACKAGE_PATTERN = /^(?:@[A-Za-z0-9_.-]{1,64}\/)?[A-Za-z0-9_.-]{1,100}$/;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

declare global {
  var __repoAssessmentRateMap: Map<string, { count: number; resetAt: number }> | undefined;
}

function getRateMap() {
  if (!globalThis.__repoAssessmentRateMap) {
    globalThis.__repoAssessmentRateMap = new Map();
  }
  return globalThis.__repoAssessmentRateMap;
}

function rateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(request: NextRequest): boolean {
  const map = getRateMap();
  const key = rateLimitKey(request);
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || entry.resetAt < now) {
    map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function isNewsCategory(value: string): value is NewsCategory {
  return (
    value === "MCP" ||
    value === "CLI" ||
    value === "Open Source" ||
    value === "Model Release" ||
    value === "Benchmark" ||
    value === "Workflow"
  );
}

export async function GET(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
  }

  const repo = request.nextUrl.searchParams.get("repo");
  const category = request.nextUrl.searchParams.get("category");
  const npmPackage = request.nextUrl.searchParams.get("npmPackage") ?? undefined;

  if (!repo || !category || !isNewsCategory(category)) {
    return NextResponse.json(
      { error: "Missing or invalid query params: repo, category" },
      { status: 400 },
    );
  }

  if (!REPO_FULLNAME_PATTERN.test(repo)) {
    return NextResponse.json(
      { error: "Invalid repo format. Expected owner/name." },
      { status: 400 },
    );
  }

  if (npmPackage && !NPM_PACKAGE_PATTERN.test(npmPackage)) {
    return NextResponse.json(
      { error: "Invalid npmPackage format." },
      { status: 400 },
    );
  }

  const result = await getRepoAssessment({
    repoFullName: repo,
    category,
    npmPackage,
  });

  if (!result) {
    return NextResponse.json(
      { error: "Repository assessment currently unavailable." },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}

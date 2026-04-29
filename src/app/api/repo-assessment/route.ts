import { NextRequest, NextResponse } from "next/server";
import type { NewsCategory } from "@/lib/feed-data";
import { getRepoAssessment } from "@/lib/repo-assessment";
import { isRateLimited } from "@/lib/rate-limit";
import { REPO_FULLNAME_PATTERN, NPM_PACKAGE_PATTERN } from "@/lib/validators";

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
  if (isRateLimited(request, { bucket: "repo-assessment", max: 30 })) {
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

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { scrapeAllSources } from "@/lib/news-scraper";
import { persistNewsSnapshot } from "@/lib/news-store";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || cronSecret.length === 0) {
    return false;
  }
  const expected = `Bearer ${cronSecret}`;
  const encoder = new TextEncoder();
  try {
    return timingSafeEqual(encoder.encode(authHeader || ""), encoder.encode(expected));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[scrape] step 1: calling scrapeAllSources...");
    const items = await scrapeAllSources();
    console.log("[scrape] step 2: got items:", items.length);

    if (items.length === 0) {
      return NextResponse.json({ 
        status: "no_items", 
        message: "Scraper found no relevant articles" 
      });
    }

    console.log("[scrape] step 3: calling persistNewsSnapshot...");
    const persistResult = await persistNewsSnapshot({
      mode: "scrape",
      items,
      benchmarks: [],
    });
    console.log("[scrape] step 4: persisted:", persistResult.status, persistResult.persistedCount);

    return NextResponse.json({
      status: "success",
      source: "scraper",
      found: items.length,
      persisted: persistResult.persistedCount,
      sources: [...new Set(items.map(i => i.sourceName))],
    });
  } catch (err) {
    console.error("[scrape] CRASH:", err);
    return NextResponse.json({
      status: "error",
      error: "Scrape failed",
    }, { status: 500 });
  }
}
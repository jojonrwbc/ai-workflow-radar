import { NextResponse } from "next/server";
import { listLatestBenchmarks } from "@/lib/news-store";

export async function GET() {
  const items = await listLatestBenchmarks();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    items,
  });
}

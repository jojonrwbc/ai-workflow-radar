import { NextResponse } from "next/server";
import { listNewsItems } from "@/lib/news-store";
import { withResolvedImages } from "@/lib/source-images";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(limitParam, 200))
    : 50;
  const items = await listNewsItems(limit);
  const hydratedItems = await withResolvedImages(items);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    total: hydratedItems.length,
    items: hydratedItems,
  });
}

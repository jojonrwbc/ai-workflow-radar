import { NextResponse } from "next/server";
import { getLatestIngestStatus } from "@/lib/news-store";
import { hasSupabaseEnv } from "@/lib/supabase-admin";

export async function GET() {
  const ingest = await getLatestIngestStatus();

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    supabaseConfigured: hasSupabaseEnv(),
    ingest,
  });
}

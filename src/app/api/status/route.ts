import { NextResponse } from "next/server";
import { getLatestIngestStatus } from "@/lib/news-store";
import { hasSupabaseEnv } from "@/lib/supabase-admin";

export async function GET() {
  const ingest = await getLatestIngestStatus();

  // Strip latestRunError from public payload — DB error messages can
  // leak schema/constraint hints. Server logs still capture them.
  const { latestRunError, ...publicIngest } = ingest;
  void latestRunError;

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    supabaseConfigured: hasSupabaseEnv(),
    ingest: publicIngest,
  });
}

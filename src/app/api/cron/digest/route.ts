import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runIngestion } from "@/lib/ingestion";

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

  const result = await runIngestion("digest");

  if (result.status === "failed") {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}

import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { isPublicInternetHostname } from "@/lib/network-safety";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      return null;
    }
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= maxBytes ? bytes : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return merged;
  } finally {
    reader.releaseLock();
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid url parameter", { status: 400 });
  }

  const isHttpProtocol = ["https:", "http:"].includes(target.protocol);
  if (!isHttpProtocol) {
    return new NextResponse("Blocked target url", { status: 400 });
  }

  const isHostAllowed = await isPublicInternetHostname(target.hostname);
  if (!isHostAllowed) {
    return new NextResponse("Blocked target url", { status: 400 });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent": "ai-workflow-radar/1.0",
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      return new NextResponse("Upstream image unavailable", { status: 404 });
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Upstream did not return an image", { status: 415 });
    }

    const bytes = await readBodyWithLimit(response, MAX_IMAGE_BYTES);
    if (!bytes) {
      return new NextResponse("Image too large", { status: 413 });
    }

    const body = Buffer.from(bytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}

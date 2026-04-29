import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { fetch as undiciFetch } from "undici";
import {
  pinnedDispatcher,
  resolveAndValidateHost,
} from "@/lib/network-safety";
import { isRateLimited } from "@/lib/rate-limit";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 6000;

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

async function validateUrl(rawUrl: string): Promise<URL | null> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!["https:", "http:"].includes(target.protocol)) {
    return null;
  }

  const resolved = await resolveAndValidateHost(target.hostname);
  return resolved ? target : null;
}

async function fetchWithRedirectValidation(
  initialUrl: URL,
  signal: AbortSignal,
): Promise<Response | { error: string; status: number }> {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const resolved = await resolveAndValidateHost(current.hostname);
    if (!resolved) {
      return { error: "Blocked target host", status: 400 };
    }
    const dispatcher = pinnedDispatcher(resolved);
    let response: Response;
    try {
      const undiciResponse = await undiciFetch(current.toString(), {
        headers: {
          "User-Agent": "ai-workflow-radar/1.0",
        },
        redirect: "manual",
        signal,
        dispatcher,
      });
      response = undiciResponse as unknown as Response;
    } finally {
      await dispatcher.close().catch(() => {});
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { error: "Redirect without Location header", status: 502 };
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { error: "Invalid redirect target", status: 502 };
      }
      const validated = await validateUrl(next.toString());
      if (!validated) {
        return { error: "Blocked redirect target", status: 400 };
      }
      current = validated;
      continue;
    }

    return response;
  }

  return { error: "Too many redirects", status: 508 };
}

export async function GET(request: NextRequest) {
  if (isRateLimited(request, { bucket: "source-image", max: 120 })) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const target = await validateUrl(rawUrl);
  if (!target) {
    return new NextResponse("Blocked target url", { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const result = await fetchWithRedirectValidation(target, controller.signal);
    if (!(result instanceof Response)) {
      return new NextResponse(result.error, { status: result.status });
    }
    const response = result;

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
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return new NextResponse(
      isAbort ? "Image fetch timed out" : "Image fetch failed",
      { status: isAbort ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

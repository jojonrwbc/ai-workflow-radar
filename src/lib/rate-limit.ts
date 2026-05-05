import type { NextRequest } from "next/server";

type RateEntry = { count: number; resetAt: number };

const DEFAULT_MAX_KEYS_PER_BUCKET = 5_000;

declare global {
  var __awrRateMaps: Map<string, Map<string, RateEntry>> | undefined;
}

function getMap(bucket: string): Map<string, RateEntry> {
  if (!globalThis.__awrRateMaps) {
    globalThis.__awrRateMaps = new Map();
  }
  let map = globalThis.__awrRateMaps.get(bucket);
  if (!map) {
    map = new Map();
    globalThis.__awrRateMaps.set(bucket, map);
  }
  return map;
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function pruneExpiredEntries(map: Map<string, RateEntry>, now: number) {
  for (const [key, entry] of map) {
    if (entry.resetAt < now) {
      map.delete(key);
    }
  }
}

function evictOldestEntries(map: Map<string, RateEntry>, maxKeys: number) {
  while (map.size >= maxKeys) {
    const oldestKey = map.keys().next().value as string | undefined;
    if (!oldestKey) {
      return;
    }
    map.delete(oldestKey);
  }
}

export function isRateLimited(
  request: NextRequest,
  options: {
    bucket: string;
    max: number;
    windowMs?: number;
    maxKeys?: number;
  },
): boolean {
  const windowMs = options.windowMs ?? 60_000;
  const maxKeys = Math.max(1, options.maxKeys ?? DEFAULT_MAX_KEYS_PER_BUCKET);
  const map = getMap(options.bucket);
  const key = clientKey(request);
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || entry.resetAt < now) {
    if (map.size >= maxKeys) {
      pruneExpiredEntries(map, now);
      evictOldestEntries(map, maxKeys);
    }
    map.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > options.max;
}

export function resetRateLimitForTests() {
  globalThis.__awrRateMaps = undefined;
}

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRateLimited, resetRateLimitForTests } from "./rate-limit";

function requestFor(ip: string): NextRequest {
  return new NextRequest("https://hook-ai.test/api/example", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("isRateLimited", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:00.000Z"));
    resetRateLimitForTests();
  });

  afterEach(() => {
    resetRateLimitForTests();
    vi.useRealTimers();
  });

  it("allows requests until the configured max is exceeded", () => {
    const request = requestFor("203.0.113.10");
    const options = { bucket: "test", max: 2, windowMs: 60_000 };

    expect(isRateLimited(request, options)).toBe(false);
    expect(isRateLimited(request, options)).toBe(false);
    expect(isRateLimited(request, options)).toBe(true);
  });

  it("resets a client after the time window expires", () => {
    const request = requestFor("203.0.113.20");
    const options = { bucket: "test", max: 1, windowMs: 1_000 };

    expect(isRateLimited(request, options)).toBe(false);
    expect(isRateLimited(request, options)).toBe(true);

    vi.advanceTimersByTime(1_001);

    expect(isRateLimited(request, options)).toBe(false);
  });

  it("uses the first x-forwarded-for address as the client key", () => {
    const request = new NextRequest("https://hook-ai.test/api/example", {
      headers: {
        "x-forwarded-for": "203.0.113.30, 198.51.100.5",
      },
    });
    const sameClient = requestFor("203.0.113.30");
    const options = { bucket: "test", max: 1, windowMs: 60_000 };

    expect(isRateLimited(request, options)).toBe(false);
    expect(isRateLimited(sameClient, options)).toBe(true);
  });

  it("evicts the oldest client when a bucket reaches maxKeys", () => {
    const options = {
      bucket: "small-bucket",
      max: 1,
      windowMs: 60_000,
      maxKeys: 2,
    };

    expect(isRateLimited(requestFor("203.0.113.1"), options)).toBe(false);
    expect(isRateLimited(requestFor("203.0.113.2"), options)).toBe(false);
    expect(isRateLimited(requestFor("203.0.113.3"), options)).toBe(false);

    expect(isRateLimited(requestFor("203.0.113.1"), options)).toBe(false);
  });

  it("prunes expired clients before evicting active ones", () => {
    const options = {
      bucket: "small-bucket",
      max: 1,
      windowMs: 1_000,
      maxKeys: 2,
    };

    expect(isRateLimited(requestFor("203.0.113.1"), options)).toBe(false);
    expect(isRateLimited(requestFor("203.0.113.2"), options)).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(isRateLimited(requestFor("203.0.113.3"), options)).toBe(false);
    expect(isRateLimited(requestFor("203.0.113.2"), options)).toBe(false);
  });
});

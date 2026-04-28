import { describe, expect, it } from "vitest";
import {
  isPublicInternetHostname,
  resolveAndValidateHost,
} from "./network-safety";

describe("isPublicInternetHostname (IP literals)", () => {
  it("blocks loopback IPv4", async () => {
    expect(await isPublicInternetHostname("127.0.0.1")).toBe(false);
    expect(await isPublicInternetHostname("127.5.5.5")).toBe(false);
  });

  it("blocks RFC1918 ranges", async () => {
    expect(await isPublicInternetHostname("10.0.0.1")).toBe(false);
    expect(await isPublicInternetHostname("172.16.5.5")).toBe(false);
    expect(await isPublicInternetHostname("192.168.1.1")).toBe(false);
  });

  it("blocks link-local + CGNAT", async () => {
    expect(await isPublicInternetHostname("169.254.169.254")).toBe(false);
    expect(await isPublicInternetHostname("100.64.1.1")).toBe(false);
  });

  it("blocks IPv6 loopback + link-local", async () => {
    expect(await isPublicInternetHostname("::1")).toBe(false);
    expect(await isPublicInternetHostname("fe80::1")).toBe(false);
    expect(await isPublicInternetHostname("fc00::1")).toBe(false);
  });

  it("blocks localhost + .local mDNS", async () => {
    expect(await isPublicInternetHostname("localhost")).toBe(false);
    expect(await isPublicInternetHostname("printer.local")).toBe(false);
  });

  it("allows public IPv4", async () => {
    expect(await isPublicInternetHostname("1.1.1.1")).toBe(true);
    expect(await isPublicInternetHostname("8.8.8.8")).toBe(true);
  });

  it("allows public IPv6", async () => {
    expect(await isPublicInternetHostname("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects empty + malformed", async () => {
    expect(await isPublicInternetHostname("")).toBe(false);
    expect(await isPublicInternetHostname("   ")).toBe(false);
  });
});

describe("resolveAndValidateHost (IP literals)", () => {
  it("returns null for blocked IPs", async () => {
    expect(await resolveAndValidateHost("127.0.0.1")).toBeNull();
    expect(await resolveAndValidateHost("10.0.0.1")).toBeNull();
    expect(await resolveAndValidateHost("169.254.169.254")).toBeNull();
  });

  it("returns pinned IP for public IPv4", async () => {
    const result = await resolveAndValidateHost("1.1.1.1");
    expect(result).not.toBeNull();
    expect(result?.ip).toBe("1.1.1.1");
    expect(result?.family).toBe(4);
  });

  it("returns family 6 for IPv6", async () => {
    const result = await resolveAndValidateHost("2606:4700:4700::1111");
    expect(result).not.toBeNull();
    expect(result?.family).toBe(6);
  });

  it("trims trailing dot + lowercases", async () => {
    expect(await resolveAndValidateHost("LOCALHOST")).toBeNull();
    expect(await resolveAndValidateHost("printer.LOCAL.")).toBeNull();
  });
});

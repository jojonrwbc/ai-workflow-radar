import { describe, expect, it } from "vitest";
import { isValidNpmPackage, isValidRepoFullName } from "./validators";

describe("isValidRepoFullName", () => {
  it("accepts standard owner/name", () => {
    expect(isValidRepoFullName("anthropics/claude-code")).toBe(true);
    expect(isValidRepoFullName("vercel/next.js")).toBe(true);
    expect(isValidRepoFullName("user_42/repo-1")).toBe(true);
  });

  it("rejects missing slash", () => {
    expect(isValidRepoFullName("just-a-repo")).toBe(false);
  });

  it("rejects multiple slashes", () => {
    expect(isValidRepoFullName("a/b/c")).toBe(false);
  });

  it("rejects leading dash or dot in owner", () => {
    expect(isValidRepoFullName("-bad/repo")).toBe(false);
    expect(isValidRepoFullName(".bad/repo")).toBe(false);
  });

  it("rejects whitespace and shell metas", () => {
    expect(isValidRepoFullName("a /b")).toBe(false);
    expect(isValidRepoFullName("a/b;rm")).toBe(false);
    expect(isValidRepoFullName("a/b$(echo)")).toBe(false);
  });

  it("rejects empty name segment", () => {
    expect(isValidRepoFullName("owner/")).toBe(false);
  });
});

describe("isValidNpmPackage", () => {
  it("accepts plain package", () => {
    expect(isValidNpmPackage("react")).toBe(true);
    expect(isValidNpmPackage("fast-xml-parser")).toBe(true);
  });

  it("accepts scoped package", () => {
    expect(isValidNpmPackage("@supabase/supabase-js")).toBe(true);
  });

  it("rejects whitespace", () => {
    expect(isValidNpmPackage("react dom")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isValidNpmPackage("")).toBe(false);
  });

  it("rejects malformed scope", () => {
    expect(isValidNpmPackage("@/foo")).toBe(false);
    expect(isValidNpmPackage("@scope/")).toBe(false);
  });
});

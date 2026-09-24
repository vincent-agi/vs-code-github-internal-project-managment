import { describe, expect, it } from "vitest";
import { isAuthError } from "../../../src/core/auth/is-auth-error";

describe("isAuthError", () => {
  it("recognizes a top-level status of 401", () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it("recognizes a nested response.status of 401 (axios/gitbeaker-style)", () => {
    expect(isAuthError({ response: { status: 401 } })).toBe(true);
  });

  it("recognizes a message mentioning 401", () => {
    expect(isAuthError(new Error("Request failed with status code 401"))).toBe(true);
  });

  it("recognizes a message mentioning 'Unauthorized'", () => {
    expect(isAuthError(new Error("401 Unauthorized"))).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isAuthError(new Error("network down"))).toBe(false);
  });

  it("returns false for a non-401 status", () => {
    expect(isAuthError({ status: 404 })).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isAuthError("boom")).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

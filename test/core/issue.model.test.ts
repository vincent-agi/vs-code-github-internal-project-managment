import { describe, expect, it } from "vitest";
import { isIssueState } from "../../src/core/models/issue.model";

describe("isIssueState", () => {
  it("accepts 'open'", () => {
    expect(isIssueState("open")).toBe(true);
  });

  it("accepts 'closed'", () => {
    expect(isIssueState("closed")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isIssueState("archived")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isIssueState(42)).toBe(false);
  });
});

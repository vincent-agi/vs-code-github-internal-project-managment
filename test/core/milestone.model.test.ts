import { describe, expect, it } from "vitest";
import { isMilestoneState } from "../../src/core/models/milestone.model";

describe("isMilestoneState", () => {
  it("accepts 'open'", () => {
    expect(isMilestoneState("open")).toBe(true);
  });

  it("accepts 'closed'", () => {
    expect(isMilestoneState("closed")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isMilestoneState("done")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isMilestoneState(null)).toBe(false);
  });
});

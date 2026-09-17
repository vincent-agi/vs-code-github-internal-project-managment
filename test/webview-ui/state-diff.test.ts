import { describe, expect, it } from "vitest";
import { hasStateChanged } from "../../src/webview-ui/state-diff";

describe("hasStateChanged", () => {
  it("returns true when there is no previous state", () => {
    expect(hasStateChanged(null, { a: 1 })).toBe(true);
  });

  it("returns false for structurally identical states with different references", () => {
    const previous = { issues: [{ id: "1", title: "Bug" }], count: 1 };
    const next = { issues: [{ id: "1", title: "Bug" }], count: 1 };
    expect(hasStateChanged(previous, next)).toBe(false);
  });

  it("returns true when a nested field changes", () => {
    const previous = { issues: [{ id: "1", title: "Bug" }] };
    const next = { issues: [{ id: "1", title: "Bug (edited)" }] };
    expect(hasStateChanged(previous, next)).toBe(true);
  });

  it("returns true when list order changes", () => {
    const previous = { issues: [{ id: "1" }, { id: "2" }] };
    const next = { issues: [{ id: "2" }, { id: "1" }] };
    expect(hasStateChanged(previous, next)).toBe(true);
  });

  it("returns false when called twice with the exact same object", () => {
    const state = { a: 1 };
    expect(hasStateChanged(state, state)).toBe(false);
  });
});

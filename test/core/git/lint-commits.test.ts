import { describe, expect, it } from "vitest";
import { lintCommits } from "../../../src/core/git/lint-commits";

describe("lintCommits", () => {
  it("marks a compliant commit as valid, with no suggestion", () => {
    const [result] = lintCommits([
      { hash: "abc", message: "fix: 🐛 escape fallback\n\nFixes #53" },
    ]);
    expect(result.valid).toBe(true);
    expect(result.suggestion).toBeUndefined();
  });

  it("flags a plain-English commit and suggests a corrected message", () => {
    const [result] = lintCommits([{ hash: "abc", message: "Fixed the login bug" }]);
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion).toMatch(/^fix: 🐛 /);
  });

  it("infers 'feat' from an Add-prefixed message", () => {
    const [result] = lintCommits([{ hash: "abc", message: "Add gitmoji picker" }]);
    expect(result.suggestion).toMatch(/^feat: ✨ /);
  });

  it("preserves an existing issue reference as a Refs trailer in the suggestion", () => {
    const [result] = lintCommits([{ hash: "abc", message: "Update config\n\nRefs #10" }]);
    expect(result.suggestion).toContain("Refs #10");
  });

  it("falls back to 'chore' for an unrecognized prefix", () => {
    const [result] = lintCommits([{ hash: "abc", message: "asdf whatever" }]);
    expect(result.suggestion).toMatch(/^chore: 🔧 /);
  });

  it("never mutates or drops the original message", () => {
    const [result] = lintCommits([{ hash: "abc", message: "Fixed the login bug" }]);
    expect(result.message).toBe("Fixed the login bug");
  });
});

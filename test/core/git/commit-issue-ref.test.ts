import { describe, expect, it } from "vitest";
import { extractIssueNumberFromCommitMessage } from "../../../src/core/git/commit-issue-ref";

describe("extractIssueNumberFromCommitMessage", () => {
  it("extracts a Fixes trailer", () => {
    expect(extractIssueNumberFromCommitMessage("fix: 🐛 escape fallback\n\nFixes #53")).toBe(53);
  });

  it("extracts a Closes trailer, case-insensitively", () => {
    expect(extractIssueNumberFromCommitMessage("feat: ✨ done\n\ncloses #7")).toBe(7);
  });

  it("extracts a Refs trailer", () => {
    expect(extractIssueNumberFromCommitMessage("chore: 🔧 wip\n\nRefs #10")).toBe(10);
  });

  it("falls back to an inline (#N) in the subject", () => {
    expect(extractIssueNumberFromCommitMessage("feat: ✨ add picker (#55)")).toBe(55);
  });

  it("prefers a trailer over an inline reference when both exist", () => {
    expect(extractIssueNumberFromCommitMessage("feat: ✨ add picker (#55)\n\nRefs #99")).toBe(99);
  });

  it("returns null when there is no issue reference", () => {
    expect(extractIssueNumberFromCommitMessage("chore: 🔧 tidy config")).toBeNull();
  });
});

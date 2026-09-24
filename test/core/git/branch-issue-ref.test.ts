import { describe, expect, it } from "vitest";
import { extractIssueNumberFromBranch } from "../../../src/core/git/branch-issue-ref";

describe("extractIssueNumberFromBranch", () => {
  it("extracts the issue number from a type/id-slug branch", () => {
    expect(extractIssueNumberFromBranch("fix/53-escape-date-fallback")).toBe(53);
  });

  it("extracts the issue number with no type prefix", () => {
    expect(extractIssueNumberFromBranch("53-escape-date-fallback")).toBe(53);
  });

  it("extracts the issue number with no slug", () => {
    expect(extractIssueNumberFromBranch("feature/61")).toBe(61);
  });

  it("returns null for a branch with no digits", () => {
    expect(extractIssueNumberFromBranch("main")).toBeNull();
    expect(extractIssueNumberFromBranch("feature/tidy-things-up")).toBeNull();
  });

  it("uses the first run of digits when multiple appear", () => {
    expect(extractIssueNumberFromBranch("fix/53-handle-2fa-flow")).toBe(53);
  });
});

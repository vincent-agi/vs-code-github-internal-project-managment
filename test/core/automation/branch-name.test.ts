import { describe, expect, it } from "vitest";
import { generateBranchName } from "../../../src/core/automation/branch-name";
import type { IIssue } from "../../../src/core/models/issue.model";

function makeIssue(overrides: Partial<IIssue> = {}): IIssue {
  return {
    id: "acme/widgets#42",
    number: 42,
    title: "Bug: panel does not open",
    body: "",
    state: "open",
    labels: [],
    assignees: [],
    milestoneId: null,
    url: "https://example.com/42",
    provider: "github",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("generateBranchName", () => {
  it("produces 'issue/<number>-<slug>' from the title", () => {
    expect(generateBranchName(makeIssue())).toBe("issue/42-bug-panel-does-not-open");
  });

  it("collapses punctuation and repeated separators", () => {
    const issue = makeIssue({ title: "Fix!!  double   spacing---in title" });
    expect(generateBranchName(issue)).toBe("issue/42-fix-double-spacing-in-title");
  });

  it("truncates long titles to 50 slug characters", () => {
    const issue = makeIssue({
      title: "This is an extremely long issue title that goes on and on and on past the limit",
    });
    const branch = generateBranchName(issue);
    const slug = branch.replace("issue/42-", "");
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(branch.endsWith("-")).toBe(false);
  });

  it("falls back to just the number when the title has no usable characters", () => {
    const issue = makeIssue({ title: "!!!" });
    expect(generateBranchName(issue)).toBe("issue/42");
  });
});

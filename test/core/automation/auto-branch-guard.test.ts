import { describe, expect, it } from "vitest";
import { shouldAutoCreateBranch } from "../../../src/core/automation/auto-branch-guard";
import type { IIssue } from "../../../src/core/models/issue.model";

function makeIssue(overrides: Partial<IIssue> = {}): IIssue {
  return {
    id: "acme/widgets#42",
    number: 42,
    title: "Bug",
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

describe("shouldAutoCreateBranch", () => {
  it("returns true when the transition is 'started-in-progress' and the current user is assigned", () => {
    const issue = makeIssue({ assignees: ["octocat"] });
    expect(shouldAutoCreateBranch(issue, "started-in-progress", "octocat")).toBe(true);
  });

  it("returns false when the transition is not 'started-in-progress'", () => {
    const issue = makeIssue({ assignees: ["octocat"] });
    expect(shouldAutoCreateBranch(issue, "closed", "octocat")).toBe(false);
    expect(shouldAutoCreateBranch(issue, "reopened", "octocat")).toBe(false);
    expect(shouldAutoCreateBranch(issue, "none", "octocat")).toBe(false);
  });

  it("returns false when the current user is not among the assignees", () => {
    const issue = makeIssue({ assignees: ["someone-else"] });
    expect(shouldAutoCreateBranch(issue, "started-in-progress", "octocat")).toBe(false);
  });

  it("returns false when the issue has no assignees", () => {
    const issue = makeIssue({ assignees: [] });
    expect(shouldAutoCreateBranch(issue, "started-in-progress", "octocat")).toBe(false);
  });

  it("is case-insensitive when matching the username", () => {
    const issue = makeIssue({ assignees: ["Octocat"] });
    expect(shouldAutoCreateBranch(issue, "started-in-progress", "octocat")).toBe(true);
  });
});

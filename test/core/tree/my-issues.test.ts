import { describe, expect, it } from "vitest";
import { selectMyOpenIssues } from "../../../src/core/tree/my-issues";
import type { IIssue } from "../../../src/core/models/issue.model";

function makeIssue(overrides: Partial<IIssue> = {}): IIssue {
  return {
    id: "acme/widgets#1",
    number: 1,
    title: "Bug",
    body: "",
    state: "open",
    labels: [],
    assignees: [],
    milestoneId: null,
    url: "https://example.com/1",
    provider: "github",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    commentsCount: 0,
    ...overrides,
  };
}

describe("selectMyOpenIssues", () => {
  it("keeps only open issues assigned to the given username", () => {
    const issues = [
      makeIssue({ id: "1", number: 1, assignees: ["octocat"] }),
      makeIssue({ id: "2", number: 2, assignees: ["someone-else"] }),
      makeIssue({ id: "3", number: 3, state: "closed", assignees: ["octocat"] }),
    ];

    expect(selectMyOpenIssues(issues, "octocat")).toEqual([
      { id: "1", number: 1, title: "Bug", url: "https://example.com/1" },
    ]);
  });

  it("matches usernames case-insensitively", () => {
    const issues = [makeIssue({ id: "1", number: 1, assignees: ["OctoCat"] })];

    expect(selectMyOpenIssues(issues, "octocat")).toHaveLength(1);
  });

  it("sorts by issue number ascending", () => {
    const issues = [
      makeIssue({ id: "2", number: 20, assignees: ["octocat"] }),
      makeIssue({ id: "1", number: 5, assignees: ["octocat"] }),
    ];

    expect(selectMyOpenIssues(issues, "octocat").map((issue) => issue.number)).toEqual([5, 20]);
  });

  it("returns an empty list when nothing is assigned to the user", () => {
    const issues = [makeIssue({ assignees: ["someone-else"] })];

    expect(selectMyOpenIssues(issues, "octocat")).toEqual([]);
  });
});

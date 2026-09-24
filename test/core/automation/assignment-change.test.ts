import { describe, expect, it } from "vitest";
import { wasNewlyAssignedToMe } from "../../../src/core/automation/assignment-change";
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
    closedAt: null,
    commentsCount: 0,
    ...overrides,
  };
}

describe("wasNewlyAssignedToMe", () => {
  it("is true when the user is added to assignees", () => {
    const before = makeIssue({ assignees: [] });
    const after = makeIssue({ assignees: ["octocat"] });
    expect(wasNewlyAssignedToMe(before, after, "octocat")).toBe(true);
  });

  it("is false when the user was already assigned", () => {
    const before = makeIssue({ assignees: ["octocat"] });
    const after = makeIssue({ assignees: ["octocat", "someone-else"] });
    expect(wasNewlyAssignedToMe(before, after, "octocat")).toBe(false);
  });

  it("is false when a different user is assigned", () => {
    const before = makeIssue({ assignees: [] });
    const after = makeIssue({ assignees: ["someone-else"] });
    expect(wasNewlyAssignedToMe(before, after, "octocat")).toBe(false);
  });

  it("is false when the user is removed from assignees", () => {
    const before = makeIssue({ assignees: ["octocat"] });
    const after = makeIssue({ assignees: [] });
    expect(wasNewlyAssignedToMe(before, after, "octocat")).toBe(false);
  });

  it("matches usernames case-insensitively", () => {
    const before = makeIssue({ assignees: [] });
    const after = makeIssue({ assignees: ["OctoCat"] });
    expect(wasNewlyAssignedToMe(before, after, "octocat")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { detectIssueTransition } from "../../../src/core/automation/issue-transition";
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

describe("detectIssueTransition", () => {
  it("reports 'closed' when state goes from open to closed", () => {
    const before = makeIssue({ state: "open" });
    const after = makeIssue({ state: "closed" });
    expect(detectIssueTransition(before, after)).toBe("closed");
  });

  it("reports 'reopened' when state goes from closed to open", () => {
    const before = makeIssue({ state: "closed" });
    const after = makeIssue({ state: "open" });
    expect(detectIssueTransition(before, after)).toBe("reopened");
  });

  it("reports 'started-in-progress' when the 'in-progress' label is added", () => {
    const before = makeIssue({ labels: [] });
    const after = makeIssue({ labels: ["in-progress"] });
    expect(detectIssueTransition(before, after)).toBe("started-in-progress");
  });

  it("reports 'none' when the 'in-progress' label is removed", () => {
    const before = makeIssue({ labels: ["in-progress"] });
    const after = makeIssue({ labels: [] });
    expect(detectIssueTransition(before, after)).toBe("none");
  });

  it("reports 'none' when nothing relevant changed", () => {
    const before = makeIssue({ title: "Bug" });
    const after = makeIssue({ title: "Bug (edited)" });
    expect(detectIssueTransition(before, after)).toBe("none");
  });

  it("prioritizes state change over label change when both happen at once", () => {
    const before = makeIssue({ state: "open", labels: [] });
    const after = makeIssue({ state: "closed", labels: ["in-progress"] });
    expect(detectIssueTransition(before, after)).toBe("closed");
  });
});

import { describe, expect, it } from "vitest";
import { formatIssueContext, parseAcceptanceCriteria } from "../../../src/core/ai/issue-context";
import type { IIssue } from "../../../src/core/models/issue.model";
import type { IMilestone } from "../../../src/core/models/milestone.model";

function makeIssue(overrides: Partial<IIssue> = {}): IIssue {
  return {
    id: "acme/widgets#42",
    number: 42,
    title: "Add Gitmoji picker",
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

function makeMilestone(overrides: Partial<IMilestone> = {}): IMilestone {
  return {
    id: "m1",
    number: 10,
    title: "AI-Driven Project & Code Management",
    description: "",
    state: "open",
    dueOn: null,
    url: "https://example.com/milestone/10",
    provider: "github",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("parseAcceptanceCriteria", () => {
  it("extracts unchecked and checked items in order", () => {
    const body = "Some text\n- [ ] first\n- [x] second\n- [X] third\nmore text";
    expect(parseAcceptanceCriteria(body)).toEqual([
      { text: "first", checked: false },
      { text: "second", checked: true },
      { text: "third", checked: true },
    ]);
  });

  it("returns an empty array when there are no task-list items", () => {
    expect(parseAcceptanceCriteria("Just a description, no checklist.")).toEqual([]);
  });
});

describe("formatIssueContext", () => {
  it("includes title, state, labels, milestone, url, and body", () => {
    const issue = makeIssue({ labels: ["enhancement", "ai"], body: "As a developer..." });
    const milestone = makeMilestone();
    const context = formatIssueContext(issue, milestone);
    expect(context).toContain("#42 Add Gitmoji picker");
    expect(context).toContain("State: open");
    expect(context).toContain("Labels: enhancement, ai");
    expect(context).toContain("Milestone: AI-Driven Project & Code Management");
    expect(context).toContain("https://example.com/42");
    expect(context).toContain("As a developer...");
  });

  it("renders 'none' when no milestone is given", () => {
    expect(formatIssueContext(makeIssue())).toContain("Milestone: none");
  });

  it("appends an Acceptance Criteria section when the body has task items", () => {
    const issue = makeIssue({ body: "Desc\n- [ ] step one\n- [x] step two" });
    const context = formatIssueContext(issue);
    expect(context).toContain("**Acceptance Criteria**");
    expect(context).toContain("- [ ] step one");
    expect(context).toContain("- [x] step two");
  });

  it("omits the Acceptance Criteria section when the body has none", () => {
    const issue = makeIssue({ body: "Just prose, no checklist." });
    expect(formatIssueContext(issue)).not.toContain("Acceptance Criteria");
  });
});

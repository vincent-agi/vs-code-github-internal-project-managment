import { describe, expect, it } from "vitest";
import { formatMilestoneContext } from "../../../src/core/ai/milestone-context";
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
    milestoneId: "m1",
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
    description: "Transform the extension for AI-driven development.",
    state: "open",
    dueOn: "2026-10-24T00:00:00Z",
    url: "https://example.com/milestone/10",
    provider: "github",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("formatMilestoneContext", () => {
  it("includes milestone metadata and description", () => {
    const context = formatMilestoneContext(makeMilestone(), []);
    expect(context).toContain("## Milestone: AI-Driven Project & Code Management");
    expect(context).toContain("State: open");
    expect(context).toContain("Due: 2026-10-24T00:00:00Z");
    expect(context).toContain("Transform the extension for AI-driven development.");
  });

  it("renders 'none' when there is no due date", () => {
    const context = formatMilestoneContext(makeMilestone({ dueOn: null }), []);
    expect(context).toContain("Due: none");
  });

  it("lists each issue's context under an Issues section", () => {
    const context = formatMilestoneContext(makeMilestone(), [
      makeIssue({ number: 54, title: "Commit builder" }),
      makeIssue({ number: 55, title: "Gitmoji picker" }),
    ]);
    expect(context).toContain("### Issues");
    expect(context).toContain("#54 Commit builder");
    expect(context).toContain("#55 Gitmoji picker");
  });

  it("omits the Issues section when there are no issues", () => {
    const context = formatMilestoneContext(makeMilestone(), []);
    expect(context).not.toContain("### Issues");
  });
});

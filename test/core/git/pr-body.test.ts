import { describe, expect, it } from "vitest";
import { buildPrBody, buildPrTitle } from "../../../src/core/git/pr-body";
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

describe("buildPrTitle", () => {
  it("appends the issue number to the title", () => {
    expect(buildPrTitle(makeIssue())).toBe("Add Gitmoji picker (#42)");
  });
});

describe("buildPrBody", () => {
  it("includes a Closes trailer, summary, commit list, and milestone link", () => {
    const issue = makeIssue({ body: "As a developer, I want a picker." });
    const milestone = makeMilestone();
    const body = buildPrBody(issue, milestone, [
      { hash: "abc1234567", message: "feat: ✨ add picker\n\nRefs #42" },
      { hash: "def8901234", message: "test: ✅ cover picker" },
    ]);

    expect(body).toContain("Closes #42 — Add Gitmoji picker");
    expect(body).toContain("As a developer, I want a picker.");
    expect(body).toContain("- abc1234 feat: ✨ add picker");
    expect(body).toContain("- def8901 test: ✅ cover picker");
    expect(body).toContain("Part of milestone: AI-Driven Project & Code Management (#10)");
  });

  it("omits the milestone line when there is no milestone", () => {
    const body = buildPrBody(makeIssue(), null, []);
    expect(body).not.toContain("Part of milestone");
  });

  it("omits the commit list when there are no commits", () => {
    const body = buildPrBody(makeIssue(), null, []);
    expect(body).not.toContain("**Commits**");
  });
});

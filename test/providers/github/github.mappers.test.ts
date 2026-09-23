import { describe, expect, it } from "vitest";
import {
  mapGithubIssueToDomain,
  mapGithubMilestoneToDomain,
  mapGithubStateToDomain,
  mapDomainIssueStateToGithub,
} from "../../../src/providers/github/github.mappers";

describe("mapGithubStateToDomain", () => {
  it("maps 'open' to 'open'", () => {
    expect(mapGithubStateToDomain("open")).toBe("open");
  });

  it("maps 'closed' to 'closed'", () => {
    expect(mapGithubStateToDomain("closed")).toBe("closed");
  });
});

describe("mapDomainIssueStateToGithub", () => {
  it("maps domain 'open' to GitHub 'open'", () => {
    expect(mapDomainIssueStateToGithub("open")).toBe("open");
  });

  it("maps domain 'closed' to GitHub 'closed'", () => {
    expect(mapDomainIssueStateToGithub("closed")).toBe("closed");
  });
});

describe("mapGithubIssueToDomain", () => {
  const rawIssue = {
    id: 123,
    number: 42,
    title: "Bug: panel does not open",
    body: "Steps to reproduce...",
    state: "open" as const,
    labels: [{ name: "bug" }, "needs-triage"],
    assignees: [{ login: "octocat" }],
    milestone: { id: 7 },
    html_url: "https://github.com/acme/widgets/issues/42",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    closed_at: null,
    comments: 3,
  };

  it("maps all fields to the domain IIssue shape", () => {
    const issue = mapGithubIssueToDomain(rawIssue, "acme/widgets");

    expect(issue).toEqual({
      id: "acme/widgets#42",
      number: 42,
      title: "Bug: panel does not open",
      body: "Steps to reproduce...",
      state: "open",
      labels: ["bug", "needs-triage"],
      assignees: ["octocat"],
      milestoneId: "7",
      url: "https://github.com/acme/widgets/issues/42",
      provider: "github",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      closedAt: null,
      commentsCount: 3,
    });
  });

  it("maps a missing milestone to null", () => {
    const issue = mapGithubIssueToDomain({ ...rawIssue, milestone: null }, "acme/widgets");
    expect(issue.milestoneId).toBeNull();
  });

  it("defaults a null body to an empty string", () => {
    const issue = mapGithubIssueToDomain({ ...rawIssue, body: null }, "acme/widgets");
    expect(issue.body).toBe("");
  });
});

describe("mapGithubMilestoneToDomain", () => {
  const rawMilestone = {
    id: 7,
    number: 3,
    title: "v1.0",
    description: "First stable release",
    state: "open" as const,
    due_on: "2026-06-01T00:00:00Z",
    html_url: "https://github.com/acme/widgets/milestone/3",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };

  it("maps all fields to the domain IMilestone shape", () => {
    const milestone = mapGithubMilestoneToDomain(rawMilestone);

    expect(milestone).toEqual({
      id: "7",
      number: 3,
      title: "v1.0",
      description: "First stable release",
      state: "open",
      dueOn: "2026-06-01T00:00:00Z",
      url: "https://github.com/acme/widgets/milestone/3",
      provider: "github",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("maps a missing due date to null", () => {
    const milestone = mapGithubMilestoneToDomain({ ...rawMilestone, due_on: null });
    expect(milestone.dueOn).toBeNull();
  });

  it("defaults a null description to an empty string", () => {
    const milestone = mapGithubMilestoneToDomain({ ...rawMilestone, description: null });
    expect(milestone.description).toBe("");
  });
});

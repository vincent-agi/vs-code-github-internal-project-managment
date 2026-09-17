import { describe, expect, it } from "vitest";
import {
  mapGitlabIssueToDomain,
  mapGitlabMilestoneToDomain,
  mapGitlabIssueStateToDomain,
  mapDomainIssueStateToGitlab,
} from "../../../src/providers/gitlab/gitlab.mappers";

describe("mapGitlabIssueStateToDomain", () => {
  it("maps 'opened' to 'open'", () => {
    expect(mapGitlabIssueStateToDomain("opened")).toBe("open");
  });

  it("maps 'closed' to 'closed'", () => {
    expect(mapGitlabIssueStateToDomain("closed")).toBe("closed");
  });
});

describe("mapDomainIssueStateToGitlab", () => {
  it("maps domain 'open' to GitLab 'opened'", () => {
    expect(mapDomainIssueStateToGitlab("open")).toBe("opened");
  });

  it("maps domain 'closed' to GitLab 'closed'", () => {
    expect(mapDomainIssueStateToGitlab("closed")).toBe("closed");
  });
});

describe("mapGitlabIssueToDomain", () => {
  const rawIssue = {
    iid: 42,
    title: "Bug: panel does not open",
    description: "Steps to reproduce...",
    state: "opened" as const,
    labels: ["bug", "needs-triage"],
    assignees: [{ username: "octocat" }],
    milestone: { id: 7 },
    web_url: "https://gitlab.com/acme/widgets/-/issues/42",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };

  it("maps all fields to the domain IIssue shape", () => {
    const issue = mapGitlabIssueToDomain(rawIssue, "acme/widgets");

    expect(issue).toEqual({
      id: "acme/widgets#42",
      number: 42,
      title: "Bug: panel does not open",
      body: "Steps to reproduce...",
      state: "open",
      labels: ["bug", "needs-triage"],
      assignees: ["octocat"],
      milestoneId: "7",
      url: "https://gitlab.com/acme/widgets/-/issues/42",
      provider: "gitlab",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("maps a missing milestone to null", () => {
    const issue = mapGitlabIssueToDomain({ ...rawIssue, milestone: null }, "acme/widgets");
    expect(issue.milestoneId).toBeNull();
  });

  it("defaults a null description to an empty string", () => {
    const issue = mapGitlabIssueToDomain({ ...rawIssue, description: null }, "acme/widgets");
    expect(issue.body).toBe("");
  });
});

describe("mapGitlabMilestoneToDomain", () => {
  const rawMilestone = {
    id: 7,
    iid: 3,
    title: "v1.0",
    description: "First stable release",
    state: "active" as const,
    due_date: "2026-06-01",
    web_url: "https://gitlab.com/acme/widgets/-/milestones/3",
  };

  it("maps all fields to the domain IMilestone shape", () => {
    const milestone = mapGitlabMilestoneToDomain(rawMilestone);

    expect(milestone).toEqual({
      id: "7",
      number: 3,
      title: "v1.0",
      description: "First stable release",
      state: "open",
      dueOn: "2026-06-01",
      url: "https://gitlab.com/acme/widgets/-/milestones/3",
      provider: "gitlab",
    });
  });

  it("maps a missing due date to null", () => {
    const milestone = mapGitlabMilestoneToDomain({ ...rawMilestone, due_date: null });
    expect(milestone.dueOn).toBeNull();
  });

  it("maps 'closed' state to domain 'closed'", () => {
    const milestone = mapGitlabMilestoneToDomain({ ...rawMilestone, state: "closed" });
    expect(milestone.state).toBe("closed");
  });
});

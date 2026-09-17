import { describe, expect, it } from "vitest";
import {
  generateBranchName,
  inferBranchType,
  looksLikeValidGitRef,
  slugify,
} from "../../../src/core/automation/branch-name";
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

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Bug: panel does not open")).toBe("bug-panel-does-not-open");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(slugify("Fix!!  double   spacing---in title")).toBe("fix-double-spacing-in-title");
  });

  it("converts accented characters to their ASCII equivalent", () => {
    expect(slugify("Résumé du problème")).toBe("resume-du-probleme");
  });

  it("strips emoji and other non-ASCII symbols entirely", () => {
    expect(slugify("Fix 🔥 crash bug 🚀")).toBe("fix-crash-bug");
  });

  it("truncates to 50 characters without a trailing hyphen", () => {
    const slug = slugify("This is an extremely long issue title that goes on and on and on past the limit");
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("inferBranchType", () => {
  it("maps a 'bug' label to 'fix'", () => {
    expect(inferBranchType(makeIssue({ labels: ["bug"] }))).toBe("fix");
  });

  it("maps an 'enhancement' label to 'feature'", () => {
    expect(inferBranchType(makeIssue({ labels: ["enhancement"] }))).toBe("feature");
  });

  it("maps a 'feature' label to 'feature'", () => {
    expect(inferBranchType(makeIssue({ labels: ["feature"] }))).toBe("feature");
  });

  it("maps a 'documentation' label to 'docs'", () => {
    expect(inferBranchType(makeIssue({ labels: ["documentation"] }))).toBe("docs");
  });

  it("falls back to 'issue' when no label matches", () => {
    expect(inferBranchType(makeIssue({ labels: ["needs-triage"] }))).toBe("issue");
  });

  it("falls back to 'issue' when there are no labels", () => {
    expect(inferBranchType(makeIssue({ labels: [] }))).toBe("issue");
  });

  it("is case-insensitive", () => {
    expect(inferBranchType(makeIssue({ labels: ["Bug"] }))).toBe("fix");
  });
});

describe("generateBranchName", () => {
  it("produces 'issue/<number>-<slug>' with the default pattern and no matching label", () => {
    expect(generateBranchName(makeIssue())).toBe("issue/42-bug-panel-does-not-open");
  });

  it("uses the inferred type in place of ${type}", () => {
    const issue = makeIssue({ labels: ["bug"] });
    expect(generateBranchName(issue)).toBe("fix/42-bug-panel-does-not-open");
  });

  it("falls back to just '${type}/${issue_id}' when the title has no usable characters", () => {
    const issue = makeIssue({ title: "!!!" });
    expect(generateBranchName(issue)).toBe("issue/42");
  });

  it("honors a custom configured pattern", () => {
    const issue = makeIssue({ labels: ["bug"] });
    expect(generateBranchName(issue, "issues/${issue_id}/${type}-${slug}")).toBe(
      "issues/42/fix-bug-panel-does-not-open",
    );
  });
});

describe("looksLikeValidGitRef", () => {
  it("accepts a normal slash-namespaced branch name", () => {
    expect(looksLikeValidGitRef("issue/42-bug-panel-does-not-open")).toBe(true);
  });

  it("rejects a name with a space", () => {
    expect(looksLikeValidGitRef("issue/42 bug")).toBe(false);
  });

  it("rejects a name containing '..'", () => {
    expect(looksLikeValidGitRef("issue/42..bug")).toBe(false);
  });

  it("rejects a name with forbidden characters", () => {
    expect(looksLikeValidGitRef("issue/42~bug^fix?")).toBe(false);
  });

  it("rejects a name starting with a dot", () => {
    expect(looksLikeValidGitRef(".issue/42")).toBe(false);
  });

  it("rejects a name ending with '.lock'", () => {
    expect(looksLikeValidGitRef("issue/42.lock")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(looksLikeValidGitRef("")).toBe(false);
  });
});

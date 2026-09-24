import type { IIssue } from "../models/issue.model";

/** The fields the sidebar tree needs for one assigned issue. */
export interface MyIssueSummary {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
}

/**
 * Open issues assigned to `username` (case-insensitive, matching
 * {@link import("../automation/auto-branch-guard").shouldAutoCreateBranch}'s
 * convention), sorted by issue number ascending.
 */
export function selectMyOpenIssues(issues: readonly IIssue[], username: string): MyIssueSummary[] {
  const lowerUsername = username.toLowerCase();
  return issues
    .filter(
      (issue) =>
        issue.state === "open" &&
        issue.assignees.some((assignee) => assignee.toLowerCase() === lowerUsername),
    )
    .sort((a, b) => a.number - b.number)
    .map(({ id, number, title, url }) => ({ id, number, title, url }));
}

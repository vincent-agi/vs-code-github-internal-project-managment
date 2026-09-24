import type { IIssue } from "../models/issue.model";

const IN_PROGRESS_LABEL = "in-progress";

/**
 * A recognized lifecycle transition between two versions of the same
 * issue. This is the event-hook foundation Phase 4 prepares: automation
 * (e.g. auto-creating a branch via {@link generateBranchName}) can react
 * to "started-in-progress" without yet being wired to any trigger.
 */
export type IssueTransition = "closed" | "reopened" | "started-in-progress" | "none";

function hasInProgressLabel(labels: readonly string[]): boolean {
  return labels.some((label) => label.toLowerCase() === IN_PROGRESS_LABEL);
}

/**
 * Compares an issue before and after an update and classifies the change.
 * State changes take priority over label changes when both occur in the
 * same update. The "in-progress" label check is case-insensitive,
 * matching {@link import("./branch-name").inferBranchType}'s convention.
 */
export function detectIssueTransition(before: IIssue, after: IIssue): IssueTransition {
  if (before.state !== after.state) {
    return after.state === "closed" ? "closed" : "reopened";
  }

  const hadInProgress = hasInProgressLabel(before.labels);
  const hasInProgress = hasInProgressLabel(after.labels);
  if (!hadInProgress && hasInProgress) {
    return "started-in-progress";
  }

  return "none";
}

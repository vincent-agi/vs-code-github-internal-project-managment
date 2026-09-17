import type { IIssue } from "../models/issue.model";
import type { IssueTransition } from "./issue-transition";

/**
 * Guards V2's auto-branch-creation trigger: only fires when an issue
 * just moved to "in progress" AND the currently authenticated user is
 * one of its assignees. Prevents creating branches on behalf of
 * teammates' issues just because this extension happened to be open
 * when they were updated.
 */
export function shouldAutoCreateBranch(
  issue: IIssue,
  transition: IssueTransition,
  currentUsername: string,
): boolean {
  if (transition !== "started-in-progress") {
    return false;
  }
  const username = currentUsername.toLowerCase();
  return issue.assignees.some((assignee) => assignee.toLowerCase() === username);
}

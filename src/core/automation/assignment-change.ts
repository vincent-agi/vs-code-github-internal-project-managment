import type { IIssue } from "../models/issue.model";

/**
 * True when `username` (case-insensitive, matching the convention used
 * throughout this module) is newly present in `after`'s assignees but
 * wasn't in `before`'s — i.e. this issue was just assigned to them,
 * rather than having already been assigned when last fetched.
 */
export function wasNewlyAssignedToMe(before: IIssue, after: IIssue, username: string): boolean {
  const lowerUsername = username.toLowerCase();
  const hadBefore = before.assignees.some((assignee) => assignee.toLowerCase() === lowerUsername);
  const hasAfter = after.assignees.some((assignee) => assignee.toLowerCase() === lowerUsername);
  return !hadBefore && hasAfter;
}

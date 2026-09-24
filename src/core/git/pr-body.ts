import type { IIssue } from "../models/issue.model";
import type { IMilestone } from "../models/milestone.model";

/** A single commit as read from `git log`. */
export interface CommitRef {
  readonly hash: string;
  readonly message: string;
}

/** Composes a PR title from the issue: `<type>: <title> (#<number>)`. */
export function buildPrTitle(issue: IIssue): string {
  return `${issue.title} (#${issue.number})`;
}

/**
 * Composes a PR/MR description from an issue, its milestone, and the
 * commits on the branch ahead of the base branch: the issue summary
 * (title/state/labels/URL, first line of body), a bullet list of commits
 * (short hash + subject line only), and a semantic link to the
 * milestone. Pure and provider-agnostic — the caller decides how to hand
 * this to GitHub/GitLab (direct API create, or a prefilled compare/MR
 * URL).
 */
export function buildPrBody(
  issue: IIssue,
  milestone: IMilestone | null,
  commits: readonly CommitRef[],
): string {
  const lines: string[] = [];
  lines.push(`Closes #${issue.number} — ${issue.title}`);
  lines.push("");

  const summary = issue.body.trim().split("\n")[0];
  if (summary) {
    lines.push(summary);
    lines.push("");
  }

  if (commits.length > 0) {
    lines.push("**Commits**");
    for (const commit of commits) {
      const subject = commit.message.split("\n")[0];
      lines.push(`- ${commit.hash.slice(0, 7)} ${subject}`);
    }
    lines.push("");
  }

  if (milestone) {
    lines.push(`Part of milestone: ${milestone.title} (#${milestone.number})`);
  }

  return lines.join("\n").trimEnd() + "\n";
}

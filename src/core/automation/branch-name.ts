import type { IIssue } from "../models/issue.model";

const MAX_SLUG_LENGTH = 50;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Generates a `git checkout -b`-ready branch name for an issue, following
 * the `issue/<number>-<slug>` convention. This is groundwork for
 * automatically creating a branch when an issue moves to "in progress"
 * (see ADR follow-up in Phase 4); it does not itself create branches.
 */
export function generateBranchName(issue: IIssue): string {
  const slug = slugify(issue.title);
  return slug ? `issue/${issue.number}-${slug}` : `issue/${issue.number}`;
}

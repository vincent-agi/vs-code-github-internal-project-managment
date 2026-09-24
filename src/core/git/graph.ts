import { extractIssueNumberFromCommitMessage } from "./commit-issue-ref";
import type { CommitRef } from "./pr-body";

/** A group of commits that all reference the same issue, or none at all. */
export interface CommitGroup {
  /** `null` for the "Unlinked" bucket — commits with no detectable issue reference. */
  readonly issueNumber: number | null;
  readonly commits: readonly CommitRef[];
}

/**
 * Groups commits by the issue number they reference (via
 * {@link extractIssueNumberFromCommitMessage}), for the semantic Git
 * Graph view. Commits with no detectable reference are collected into a
 * single group with `issueNumber: null` ("Unlinked") rather than
 * dropped, so nothing silently disappears from the view. Groups are
 * ordered by descending issue number, with the "Unlinked" group last;
 * within a group, commits keep their input order.
 */
export function groupCommitsByIssue(commits: readonly CommitRef[]): CommitGroup[] {
  const byIssue = new Map<number | null, CommitRef[]>();
  for (const commit of commits) {
    const issueNumber = extractIssueNumberFromCommitMessage(commit.message);
    const bucket = byIssue.get(issueNumber);
    if (bucket) {
      bucket.push(commit);
    } else {
      byIssue.set(issueNumber, [commit]);
    }
  }

  const linked: CommitGroup[] = [...byIssue.entries()]
    .filter((entry): entry is [number, CommitRef[]] => entry[0] !== null)
    .sort((first, second) => second[0] - first[0])
    .map(([issueNumber, groupCommits]) => ({ issueNumber, commits: groupCommits }));

  const unlinked = byIssue.get(null);
  if (unlinked && unlinked.length > 0) {
    linked.push({ issueNumber: null, commits: unlinked });
  }

  return linked;
}

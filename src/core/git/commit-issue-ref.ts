/**
 * Extracts the issue number a commit message references, checking (in
 * order) a `Fixes #N` / `Closes #N` / `Refs #N` trailer anywhere in the
 * message (GitHub's closing keywords, case-insensitive), then a trailing
 * inline `(#N)` in the subject line. Returns `null` when neither is
 * present — such commits are "unlinked".
 */
export function extractIssueNumberFromCommitMessage(message: string): number | null {
  const trailerMatch = message.match(/\b(?:fixes|closes|refs|references)\s+#(\d+)\b/i);
  if (trailerMatch) {
    return Number(trailerMatch[1]);
  }
  const subject = message.split("\n")[0] ?? "";
  const inlineMatch = subject.match(/\(#(\d+)\)\s*$/);
  if (inlineMatch) {
    return Number(inlineMatch[1]);
  }
  return null;
}

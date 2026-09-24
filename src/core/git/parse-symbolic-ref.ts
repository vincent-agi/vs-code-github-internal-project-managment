const REMOTE_HEAD_PREFIX = "refs/remotes/origin/";

/**
 * Extracts the branch name from `git symbolic-ref refs/remotes/origin/HEAD`'s
 * raw output (e.g. `"refs/remotes/origin/main\n"` -> `"main"`).
 *
 * Strips only the known `refs/remotes/origin/` prefix rather than taking
 * the last `"/"`-separated segment, so a default branch whose own name
 * contains a `/` (e.g. `"release/2.0"`) isn't silently truncated to its
 * last path segment (`"2.0"`).
 *
 * @returns The branch name, or `undefined` if `ref` doesn't have the
 * expected prefix.
 */
export function parseSymbolicRefBranch(ref: string): string | undefined {
  const trimmed = ref.trim();
  return trimmed.startsWith(REMOTE_HEAD_PREFIX)
    ? trimmed.slice(REMOTE_HEAD_PREFIX.length)
    : undefined;
}

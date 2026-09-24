/**
 * Resolves a (possibly attacker-influenced, e.g. from a workspace
 * setting) relative path into a normalized list of path segments safe
 * to join onto a workspace root, rejecting anything whose `..` segments
 * would traverse above that root. Accepts both `/` and `\` as
 * separators. Returns `null` when the path would escape the root.
 *
 * This intentionally rejects only a *net* escape (an early `..` that a
 * later segment doesn't re-enter, e.g. `"sub/../../secret"` — 1 push, 2
 * pops) rather than any `..` token at all, so an incidental `"a/../b"`
 * that still resolves inside the root is accepted.
 */
export function resolveSafeRelativeSegments(relativePath: string): string[] | null {
  const rawSegments = relativePath.split(/[\\/]+/).filter((segment) => segment.length > 0);
  const stack: string[] = [];
  for (const segment of rawSegments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (stack.length === 0) {
        return null;
      }
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return stack;
}

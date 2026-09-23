const PREFERRED_BASE_BRANCHES = ["main", "master"];

/**
 * Picks which branch should be preselected as the base for a new branch,
 * from a list of candidates: `main` wins over `master` when both exist,
 * and neither is required to be present.
 */
export function pickDefaultBaseBranch(branches: readonly string[]): string | undefined {
  for (const candidate of PREFERRED_BASE_BRANCHES) {
    if (branches.includes(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

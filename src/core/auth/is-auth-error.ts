/**
 * Best-effort detection of an HTTP 401 from a provider API call, across
 * the differently-shaped errors GitLab's gitbeaker client and GitHub's
 * Octokit client each throw, so a stale/revoked token can trigger a
 * re-prompt instead of a generic error toast.
 */
export function isAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { status?: unknown; response?: { status?: unknown }; message?: unknown };
  if (candidate.status === 401 || candidate.response?.status === 401) {
    return true;
  }
  return typeof candidate.message === "string" && /\b401\b|unauthorized/i.test(candidate.message);
}

# ADR-0003: V1 Hardening — Auth, Caching, Multi-root, Webview State

## Status

Accepted

## Context

Before adding V2's auto-branch feature, four V1 gaps needed closing:
secret handling, API rate-limit exposure, single-repo-only assumptions,
and unnecessary webview re-renders. Each is addressed independently
below, since they touch different layers.

## Decisions

### GitHub auth moves to VS Code's native session; GitLab keeps PAT+SecretStorage

`vscode.authentication.getSession('github', ['repo'], { createIfNone: true })`
replaces the PAT prompt for GitHub. VS Code owns and persists that
session; our code never sees or stores a raw GitHub token. GitLab has no
built-in VS Code auth provider, so it keeps the existing `ensureToken` +
`SecretStorage` flow — which already satisfied the "never store in
globalState/workspaceState/json" rule, since it only ever wrote through
`context.secrets`.

### Caching is the rate-limiting mechanism

Rather than a separate token-bucket limiter, `CachingProjectProvider`
(decorator over any `IProjectProvider`) caches `listIssues`,
`listMilestones`, and `getCapabilities` behind a `TtlCache` (default
180s, `remoteProjectManager.cacheTtlSeconds`). This directly reduces call
volume, which is the actual goal behind "rate limiting" here — a fixed
window is simpler to reason about than a request-budget algorithm, and
matches how often issue/milestone data realistically changes.

Every write invalidates the relevant cached list immediately (not after
the TTL), so a user's own edit is never masked by stale cached data. A
new "Refresh" button in the webview sends `forceRefresh: true`, which
`CachingProjectProvider` honors by bypassing the cache for that one call
— this is the "manual data fetch" escape hatch.

Single-item reads (`getIssue`, `getMilestone`) and `getCurrentUser` pass
straight through uncached: `getIssue` is used immediately before a write
to detect transitions (ADR-0002) and must be current, and
`getCurrentUser` is called once per session.

### Multi-root: resolve by `origin` remote, pick inside the webview

`resolveRepositoryCandidates` (`src/core/workspace/repository-resolver.ts`)
inspects every workspace folder's `origin` remote via `IGitService` and
matches `github.com`/`gitlab.com` hosts. Precedence:

1. An explicit `remoteProjectManager.repository` setting always wins —
   no detection runs.
2. Exactly one detected candidate is used automatically.
3. Multiple candidates: the panel opens, and a picker renders *inside*
   the webview (`repositoryOptions` / `selectRepository` messages) per
   the spec, rather than a native `QuickPick`. No token is requested and
   no provider is built until the user picks — avoids an unnecessary
   auth prompt for a repo they might not choose.

Self-hosted GitLab (custom domains) is out of scope for auto-detection;
only `github.com`/`gitlab.com` are recognized. Supporting arbitrary
hosts would need a settings-based host allowlist, deferred until needed.

### Webview re-render guard is a structural diff, not a subscription model

`hasStateChanged` (`src/webview-ui/state-diff.ts`) compares the incoming
`state` message against the last one by JSON content; `main.ts` skips
re-rendering the DOM when nothing changed. This is deliberately the
simplest thing that works: the panel already uses
`retainContextWhenHidden: true`, so regaining focus does not tear down
or refetch the webview — the remaining cost was rebuilding the DOM on
every push even when a TTL-cache hit returned identical data, which this
closes.

A fuller state-management library (Redux-style store, virtual-DOM diffing)
was considered and rejected as disproportionate to a two-list, two-detail-pane
UI (KISS).

`hasStateChanged` is unit tested in isolation, then mirrored by hand into
`main.ts`: that file compiles under `tsconfig.webview.json` with
`module: "none"` (a single plain `<script>`, no bundler), so it cannot
use a real `import`. The same pattern already applied to the message
type mirror at the top of `main.ts`; this is documented there and in
this ADR so the duplication doesn't come as a surprise.

## Consequences

- `CachingProjectProvider` trades a small correctness risk (another
  editor changing the same repo won't be seen until the TTL expires or
  Refresh is pressed) for far fewer API calls. Documented for the user
  via the Refresh button's tooltip.
- Multi-root detection only recognizes `github.com`/`gitlab.com`; a
  workspace using a self-hosted GitLab must still set
  `remoteProjectManager.repository` explicitly.
- `main.ts`'s manual mirroring of `hasStateChanged` and the message types
  is a known, accepted duplication cost of not introducing a bundler.

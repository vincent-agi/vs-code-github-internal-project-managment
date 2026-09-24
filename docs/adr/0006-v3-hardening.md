# ADR-0006: V3 Hardening — Concurrency, Path Safety, and Provider Capability Corrections

## Status

Accepted

## Context

Following ADR-0005's git-automation/AI-context commands, five targeted
review passes (state/concurrency, provider/mapper correctness, VS Code
integration robustness, webview security, and the new git-automation
modules themselves) plus a general sweep — mirroring ADR-0003's original
"V1 Hardening" methodology — found twelve real defects, filed and fixed
one at a time. Most are tactical bug fixes that don't individually warrant
an ADR; three involve an actual design decision worth recording.

## Decisions

### `openPanel` serializes through an in-flight lock

`activePanel`/`activeController` (ADR-0001's single-panel state) weren't
assigned until after an `await resolveRepository()` — and, on the
"resolved" path, an `await buildController()`. Five different commands all
call `openPanel` fire-and-forget (`openPanel`, `openIssueFromTree`,
`newIssue`, `newMilestone`, `refresh`); two arriving in quick succession
(e.g. a fast double-click on a sidebar tree item) could both observe no
active panel yet and each build their own — duplicate token prompts, and
whichever `buildController` finished last silently overwriting
`activeProvider`/`activeFolderPath`, possibly out of sync with whichever
panel `activePanel` ended up pointing at.

Alternatives considered: a boolean "is opening" flag (simpler, but a caller
arriving mid-open would need to poll or be dropped rather than getting the
panel it asked for once ready) and re-deriving the panel from VS Code's own
tab APIs (more invasive, `activePanel` already exists as the source of
truth elsewhere). Chosen instead: an `openPanelInFlight: Promise<void>`
that a concurrent call awaits, then re-enters `openPanel` recursively — the
re-entry sees whatever the first call actually produced (an open panel to
reveal, or a clean slate to build against) rather than guessing.

### `aiContextFile` path resolution rejects net-escaping `..`, not any `..` token

`exportMilestoneContext` (ADR-0005) resolves the configured
`remoteProjectManager.aiContextFile` against the workspace root via
`vscode.Uri.joinPath`, which resolves `..` segments upward per its
documented behavior — with no bound at the workspace folder. Since this
setting is plain workspace-scoped config (settable by a repository's own
`.vscode/settings.json`), an untrusted repository could point it outside
the workspace and have the export command overwrite an arbitrary file.

`resolveSafeRelativeSegments` (`src/core/workspace/safe-relative-path.ts`)
normalizes the path segment-by-segment (tracking depth like a directory
stack) and rejects only a _net_ escape — an early `..` with nothing earlier
to consume it — rather than rejecting any `..` token outright. A stricter
"reject any `..`" rule was considered and rejected: it would also reject
harmless, legitimately-authored values like `"notes/../context.md"` that
still resolve inside the workspace, for no additional safety over the
net-escape check.

### Provider capability computation corrected to match each platform's real permission model

Two GitLab and one GitHub capability-computation bugs were found by the
provider/mapper-correctness pass, all in `getCapabilities`/
`listAssignableUsers`:

- GitHub's `permissions.triage` (a role granting issue write without repo
  push access) wasn't consulted at all — only `push`. `canWriteIssues` is
  now `push || triage`; `canWriteMilestones` stays `push`-only, since
  Triage doesn't cover milestone create/edit.
- GitLab's effective access level used `project_access.access_level ??
group_access.access_level`, so a low _direct_ grant (e.g. Reporter) won
  over a higher _inherited_ one (e.g. Maintainer via group membership) —
  when GitLab's real API can return both at once. Changed to
  `Math.max(...)` of both.
- GitLab's `ProjectMembers.all()` defaulted to direct members only
  (gitbeaker/GitLab's `/members` endpoint); a project's group-inherited
  members — the common access pattern on larger GitLab projects — never
  appeared in `listAssignableUsers`, and were silently dropped from
  `assignee_ids` on issue create/update. Now passes
  `{ includeInherited: true }`.

These are corrections to match each platform's actual documented
permission model, not new policy — no alternative was considered beyond
"read the real API/type defs and match them" (verified against
`@octokit/openapi-types` and `@gitbeaker/core`'s own types, not just this
codebase's prior assumptions).

## Other fixes from this pass (no separate design decision)

- `commit-message.ts`'s validator regex matched only a single
  `\p{Extended_Pictographic}` codepoint; 17 of the 65 bundled Gitmoji
  glyphs are multi-codepoint (variation selector or ZWJ) sequences, so
  `lintCommitHistory` flagged commits composed by its own Gitmoji picker as
  non-compliant. Now matches a full emoji grapheme cluster.
- `createPrFromIssue`'s `gitService.log(...)` call sat outside the
  try/catch guarding the branch resolution above it, so it could fail as
  an unhandled rejection (silently, no error shown) instead of a reported
  error.
- `signOutGitLab` didn't clear `activeProvider`/`activeFolderPath`, so the
  AI-context/git-automation commands kept reusing a provider built with
  the just-deleted token until the cache TTL expired.
- `getScmInputBox` fell back to `repositories[0]` instead of `undefined`
  when no repository's path matched, contradicting its own doc comment —
  in a multi-root workspace, `composeCommit` could write into an unrelated
  repo's Source Control input box.
- Issue/milestone `href`s were entity-escaped (`escapeAttr`) but not
  scheme-validated; a `javascript:` URL from a compromised/malicious
  provider would render as a clickable link. Defense-in-depth only — the
  webview's CSP already blocks `javascript:` URI navigation under its
  strict `script-src` — but nothing guaranteed that on its own. Added
  `safeHref()`, allowing only `http:`/`https:`.
- `.vscodeignore` excluded `test/**` but not the newer `test-integration/**`
  (ADR-0005's companion end-to-end suite), shipping test scaffolding in the
  packaged `.vsix`.

## Consequences

- `openPanel`'s lock only serializes the racy setup phase (state checks
  through panel/controller creation kickoff), not the full user
  interaction lifetime — the multi-root repository picker still waits on
  the user without holding the lock.
- `resolveSafeRelativeSegments`'s net-escape-only rule means a value that
  _looks_ suspicious (contains `..`) but stays inside the workspace is
  still accepted; only genuine escapes are rejected. If this setting's
  trust model changes later (e.g. it becomes settable from a fully
  untrusted source), revisit toward a stricter "any `..` rejected" rule.
- The GitHub/GitLab capability fixes widen who the panel and new commands
  treat as able to write — verified against each platform's documented
  model, but not against a live account of each affected role/grant shape
  (Triage, mixed project+group access, group-inherited membership); worth
  a manual spot-check against a real repository in each configuration if
  one becomes available.

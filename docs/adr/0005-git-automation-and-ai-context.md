# ADR-0005: Git Automation and AI Context Export Commands

## Status

Accepted

## Context

The "AI-Driven Project & Code Management" milestone asks for a standardized
commit format (Conventional Commits + Gitmoji), semantic linking between
commits/issues/milestones, and structured context export for AI coding
agents (Copilot Chat, Claude Code, Continue.dev, ...) — all as standalone
commands, not as new panel UI. Three design questions follow:

1. Where does this logic live, given ADR-0001's layering?
2. How does a command know which issue/milestone it's "currently working
   on," without a server-side notion of "the active issue" anywhere in the
   panel's state?
3. Does this need a connected provider (and therefore a token), and if so,
   does it require the panel to be open first?

## Decision

### New pure modules under `src/core/git/` and `src/core/ai/`

Following ADR-0001's domain layer (no VS Code import, no HTTP client
import), each concern got its own small, independently unit-tested module:

- `src/core/git/commit-message.ts` — `buildCommitMessage`/
  `validateCommitMessage` against `<type>(<scope>): <gitmoji> <description>`.
- `src/core/git/gitmoji.ts` — parses/validates the bundled
  `resources/gitmojis.json` reference list.
- `src/core/git/branch-issue-ref.ts` / `commit-issue-ref.ts` — extract an
  issue number from a branch name or a commit message, respectively (see
  "active issue" below).
- `src/core/git/graph.ts` — groups commits by referenced issue.
- `src/core/git/lint-commits.ts` — flags non-compliant commits and builds a
  best-effort suggested correction, reusing `validateCommitMessage`.
- `src/core/git/pr-body.ts` — composes a PR title/description from an
  issue, its milestone, and its commits.
- `src/core/ai/issue-context.ts` / `milestone-context.ts` — render an
  issue/milestone as a Markdown block for AI agents.
- `src/core/ai/managed-section.ts` — idempotently replaces an
  HTML-comment-delimited section of a file, so exporting doesn't clobber a
  hand-edited `.github/copilot-instructions.md`.

`IGitService` (ADR-0004) gained two methods to back these:
`getCurrentBranch(cwd)` and `log(cwd, range?)`, implemented in
`SimpleGitService` the same way as its existing methods — a thin wrapper
over `simple-git`, not unit tested itself (nothing to test but
`simple-git`'s own behavior), with the actual parsing/grouping/linting
logic living in the tested `core/` modules above.

### "Active issue" is resolved from the current branch name, not tracked state

The panel has no server-side concept of "the issue currently open in the
webview" — selection is UI-local state in `main.ts`, never reported back to
the extension host. Two options were considered for the new commands
(`copyIssueContext`, `createPrFromIssue`, `exportMilestoneContext`, and
`composeCommit`'s issue-reference step) to know which issue they're acting
on:

- **Track the webview's selection**, adding a new outbound message and
  extension-host state for it.
- **Derive it from the current git branch name**, reusing
  `extractIssueNumberFromBranch` against the same `${issue_id}` placeholder
  `generateBranchName` (ADR-0002) already encodes.

The branch-name approach was chosen: it needs no new webview message, no
new state to keep in sync, and it's _more_ correct for these commands'
actual use case — composing a commit or opening a PR is inherently tied to
"the branch I'm currently on," not "whatever issue happened to be open in
the panel last." `resolveActiveIssueViaBranch` (`extension.ts`) implements
this: current branch → `extractIssueNumberFromBranch` → look up that number
in `provider.listIssues()`. Every command that needs it falls back to a
`QuickPick` of open issues (or, for `createPrFromIssue`, an explicit error)
when the branch encodes no issue number — never silently guesses.

### `connectRepository()` extracted so these commands work without an open panel

`copyIssueContext`/`createPrFromIssue`/`exportMilestoneContext` are useful
standalone (e.g. from a terminal-adjacent workflow), not only while the
panel happens to be open. `getActiveConnection()` reuses
`activeProvider`/`activeFolderPath` when a panel is already connected, and
falls back to resolving + connecting fresh otherwise — sharing the same
`connectRepository()` helper that `buildController` and the sidebar's
`MyIssuesTreeDataProvider` already used (previously duplicated between the
two; now a single function, reducing drift risk between the three
consumers).

### Gitmoji picker is a QuickPick, not a new webview tab

The original brief mentioned a Webview Panel _or_ a VS Code QuickPick for
the Gitmoji picker, and a webview tab for the Git Graph view. Both were
built as `showQuickPick`-based flows instead of new webview surfaces:
QuickPick gets fuzzy search for free, needs no new message types or HTML,
and the commands are inherently single-shot/keyboard-driven (compose a
commit, browse a graph) rather than a persistent view someone leaves open —
a better fit than extending the panel's webview for this. This is a
narrower scope than the original "Git Graph view" idea (which implied a
graphical, always-visible graph); a full graphical view remains open for a
future ADR if the QuickPick-based browser turns out not to be enough.

## Consequences

- These commands' provider connection is best-effort: `getActiveConnection`
  reports "No connected repository" rather than opening the panel or
  prompting for a token itself when nothing is already connected and no
  `remoteProjectManager.repository` is set (see [Git Automation and AI
  Context Commands](../functionals/05-git-automation-and-ai-context.md)).
- Branch-derived "active issue" means these commands behave differently on
  a branch that doesn't encode an issue number (e.g. `main`, or a
  hand-named branch) — most fall back to a picker; `createPrFromIssue`
  can't meaningfully guess a target issue for a PR and errors instead.
- The Gitmoji picker and Git Graph browser are QuickPick-based, not
  webview UI — see "hardening" follow-ups in
  [ADR-0006](0006-v3-hardening.md) for the correctness issues a bug-hunt
  pass found in this first implementation.

# Git Automation and AI Context Commands

This guide covers the Command Palette commands added for a standardized
commit format (Conventional Commits + Gitmoji) and for exporting
structured context to AI coding agents (Copilot Chat, Claude Code,
Continue.dev, ...). Unlike the central panel, these are standalone
commands — no new webview UI. See [ADR-0005](../adr/0005-git-automation-and-ai-context.md)
for the design decisions behind them.

## How the "active issue" is resolved

Several commands below act on "the issue you're currently working on."
There's no persistent notion of that anywhere in the panel — it's resolved
fresh, each time, from your **current git branch name**:

1. Read the current branch (`git rev-parse --abbrev-ref HEAD`).
2. Extract the first run of digits in it — the same `${issue_id}`
   placeholder [Automated Branch Workflow](03-automated-branch-workflow.md)
   fills in when it creates a branch for you (e.g. `fix/53-escape-fallback`
   → `53`).
3. Look that number up against `listIssues()`.

If the branch encodes no issue number (e.g. `main`, or a hand-named
branch), most commands fall back to a `QuickPick` of open issues instead of
guessing; **Create PR from Issue** can't meaningfully guess a PR's target
issue and shows an error instead.

## Commands

### Compose Commit (Conventional + Gitmoji)

Walks through, in order:

1. **Type** — a `QuickPick` over the standard Conventional Commits types
   (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
   `ci`, `chore`, `revert`).
2. **Scope** — optional free text.
3. **Gitmoji** — the same picker as the standalone command below.
4. **Description** — required free text.
5. **Issue reference** — pre-filled from your current branch (see above);
   if none is detected, you're asked to type an issue number or skip.
   Choosing one offers `Fixes #N` (closes the issue on merge to the
   default branch) or `Refs #N` (references it without closing).

The composed message (`<type>(<scope>): <gitmoji> <description>`, with an
issue reference appended as a `Fixes #N`/`Refs #N` trailer on its own line
— not inline in the subject, since GitHub only recognizes the closing
keyword as a trailer) is written into the Source Control input box of the
git repository matching your current workspace folder, via the built-in
`vscode.git` extension. If that extension isn't active, or no repository
in a multi-root workspace exactly matches, the message is copied to the
clipboard instead — it will **not** be written into an unrelated repository's
input box.

Backing out (<kbd>Esc</kbd>) at any step cancels the whole flow without
touching the Source Control input box.

### Pick Gitmoji

The same searchable Gitmoji picker, standalone. With an active text editor,
inserts the chosen emoji at the cursor; otherwise copies it to the
clipboard. The reference list is bundled at `resources/gitmojis.json`.

### Copy Issue Context for AI

Copies the active issue's context — title, state, labels, milestone, body,
and any `- [ ]`/`- [x]` acceptance-criteria checklist parsed out of the
body — as a Markdown block to the clipboard. Also exposed programmatically:
another extension can read
`vscode.extensions.getExtension('local-dev.remote-project-manager').exports.getActiveIssueContext()`
to get the same block from the last invocation.

### Create PR from Issue

Opens a prefilled GitHub compare URL (`.../compare/<base>...<branch>?quick_pull=1&title=...&body=...`)
or GitLab merge-request URL, built from the active issue, its commits
ahead of the repository's default branch, and its milestone (if any).
Requires the current branch to encode an issue number — see "active issue"
above.

### Show Git Graph (by Issue)

Reads the last 200 commits and groups them by the issue number they
reference (a `Fixes #N`/`Closes #N`/`Refs #N` trailer, or a trailing
`(#N)` in the subject — checked in that order), with an "Unlinked" group
for the rest. Pick a group, then a commit, to copy that commit's hash to
the clipboard.

### Lint Commit History

Checks the last 100 commits against the `<type>(<scope>): <gitmoji>
<description>` convention. Non-compliant commits are listed with a
best-effort **suggested correction** (inferred type from common prefixes
like "Fixed"/"Add"/"Update", a default Gitmoji for that type, and any
existing issue reference preserved as a `Refs #N` trailer) — picking one
copies the suggestion to the clipboard. **This never rewrites history
automatically**; it's on you to `git commit --amend` (for an unpushed
commit) or just apply the convention going forward.

### Export Milestone Context for AI Agents

Writes the active milestone's context — title, state, due date,
description, and every one of its issues' context (same format as **Copy
Issue Context for AI**) — to a Markdown file, default
`.github/copilot-instructions.md`, configurable via
`remoteProjectManager.aiContextFile`.

Re-running this command only replaces its own managed section (marked by
`<!-- remote-project-manager:milestone-context:start/end -->` HTML
comments) — anything else you've hand-written in that file is left alone.

**Path safety:** `remoteProjectManager.aiContextFile` is validated against
the workspace root before anything is written. A value whose `..` segments
would resolve outside the workspace folder (e.g. from a value set in a
repository's own committed `.vscode/settings.json`, not just your own user
settings) is rejected with an error instead of writing anywhere.

## Connection requirements

**Copy Issue Context for AI**, **Create PR from Issue**, and **Export
Milestone Context for AI Agents** need a connected provider (a token).
They reuse the panel's connection if it's already open; otherwise they
connect fresh the same way the panel would (auto-detecting the repository
or using `remoteProjectManager.repository`). If neither works, you'll see
"No connected repository" instead of a silent failure — open the panel
once, or set `remoteProjectManager.repository`, and try again.

**Compose Commit**, **Pick Gitmoji**, **Show Git Graph**, and **Lint Commit
History** don't need a provider connection at all — they only touch the
local git repository (except Show Git Graph's optional issue-title
decoration, which uses the panel's connection if one is open, and silently
falls back to plain `#N` labels otherwise).

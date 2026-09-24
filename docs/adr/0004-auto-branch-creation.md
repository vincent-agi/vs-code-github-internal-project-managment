# ADR-0004: Auto-Branch Creation — Git Execution Safety and Naming

## Status

Accepted

## Context

V2 automatically creates and checks out a branch when an issue assigned
to the current user moves to "in progress" (ADR-0002 already defined
that transition). Two things need care: never touching the user's
working tree destructively, and generating a branch name that is both
predictable and a valid git ref.

## Decisions

### Git operations behind `IGitService`, executed by `simple-git`

`IGitService` (`src/core/git/git-service.interface.ts`) declares the
operations needed: remote lookup, dirty-tree status, fetch, stash,
default-branch resolution, checkout, and `check-ref-format` validation
(current-branch lookup and commit log reading were added later for
ADR-0005's git-automation commands). `SimpleGitService` implements it over
the `simple-git` package rather
than hand-built `child_process` calls, trading one dependency for typed,
promise-based results and not having to hand-parse `git status`
porcelain output ourselves.

Like the VS Code SecretStorage/webview adapters (ADR-0001), `SimpleGitService`
is a thin wrapper over an external process and is not unit tested — there
is nothing to test but simple-git's own behavior. All the actual decision
logic lives in `BranchManager`, tested against a fake `IGitService`.

### BranchManager owns the safety sequence; the caller only supplies UI

`BranchManager.createBranchForIssue` runs, in order:

1. Generate the branch name, reject early via `looksLikeValidGitRef`
   (fast, dependency-free) and then the authoritative
   `IGitService.isValidBranchName` (real `git check-ref-format --branch`).
2. Check working-tree status. If dirty, await the caller-supplied
   `onDirtyWorkingTree()` prompt, resolving to `"cancel"`, `"stash"`, or
   `"force"` — `BranchManager` does not know how that prompt is shown; in
   `extension.ts` it is a modal `vscode.window.showWarningMessage`, but
   the interface stays UI-framework-agnostic for testability.
3. Fetch `origin`, resolve the default branch (tries the symbolic ref
   first, then `main`/`master`/`devel` in order), and check out the new
   branch based on `origin/<default>` — never on the possibly-stale local
   default branch.

`"force"` deliberately does not attempt to discard changes itself; it
skips the stash step and lets `git checkout -b` behave as it normally
would (carrying compatible changes over, or failing loudly on a real
conflict, which surfaces as `BranchCreationResult.status === "error"`).
Reimplementing git's own conflict detection would violate KISS for no
real benefit.

### Branch type comes from labels; pattern is configurable

`generateBranchName(issue, pattern)` fills `${type}`, `${issue_id}`,
`${slug}` into a pattern (default `${type}/${issue_id}-${slug}`,
`remoteProjectManager.branchNamePattern`). `inferBranchType` maps common
labels (`bug`→`fix`, `enhancement`/`feature`→`feature`,
`documentation`/`docs`→`docs`, `chore`→`chore`) case-insensitively,
falling back to `issue`. `slugify` normalizes accented characters to
ASCII via Unicode NFKD before stripping (so `é` becomes `e`, not
disappearing), lowercases, hyphenates, and truncates to 50 characters
without a trailing hyphen.

## Consequences

- `BranchManager` never runs on a repository VS Code doesn't know the
  folder path for (e.g. an explicit `remoteProjectManager.repository`
  setting with no workspace folder open). In that case `extension.ts`
  falls back to the old "suggested branch name" info message instead of
  attempting git operations against an unknown `cwd`.
- The label→type mapping is a fixed table, not user-configurable; adding
  a settings-based override is straightforward later if teams want
  different label vocabularies, but was out of scope for this pass.
- `"force"` can still fail (e.g. a genuine merge conflict); this is
  surfaced as an error message rather than silently discarding the
  user's changes, consistent with never taking a destructive action
  without the user having chosen it explicitly.

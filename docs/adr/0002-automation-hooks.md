# ADR-0002: Issue Transition Hooks and Branch Naming Convention

## Status

Accepted

## Context

Phase 4 asks for two pieces of forward-looking groundwork, without fully
building the automation yet:

1. A hook that fires on issue status changes (e.g. moving to "in progress").
2. A branch naming convention for branches created from an issue.

Two design questions follow directly from this scope:

- Our domain `IssueState` is only `"open" | "closed"` (see ADR-0001);
  neither GitHub nor GitLab has a native "in progress" issue state. Most
  teams represent it with a label instead (commonly `in-progress`).
- Where does the hook live, and what triggers it?

## Decision

### "In progress" is a label, not a state

`detectIssueTransition(before, after)` (`src/core/automation/issue-transition.ts`)
compares two `IIssue` snapshots and returns one of:

- `"closed"` / `"reopened"` — from `state` changing.
- `"started-in-progress"` — from the `in-progress` label being added.
- `"none"` — otherwise.

State changes take priority when both happen in the same update, since a
closed issue moving to "in progress" is not a meaningful automation
trigger.

### The hook lives on PanelController, not on the provider

`PanelController` (the already-tested UI state manager from Phase 3)
gains an optional `onIssueTransition` callback. On `updateIssue`, it
fetches the pre-update issue, diffs it against the result, and invokes
the callback when the transition is not `"none"`.

Alternatives considered:

- **Provider-level webhooks** — GitHub/GitLab webhooks would catch
  changes made outside the extension too, but need a public endpoint to
  receive them; out of scope for a local extension.
- **Polling** — would catch external changes but adds complexity and
  rate-limit pressure for a "future scope" feature.

Hooking at `PanelController` is the minimal correct choice for changes
made through this extension, and keeps the automation trigger decoupled
from any specific provider (Dependency Inversion, per ADR-0001).

### Branch naming convention

`generateBranchName(issue)` produces `issue/<number>-<slug>`, e.g.
`issue/42-bug-panel-does-not-open`. The slug is lowercased, non-alphanumeric
runs collapsed to single hyphens, and capped at 50 characters. This
mirrors the convention used by `gh issue develop` and GitLab's
"create branch from issue" button, so branches created by future
automation will look familiar to developers already using those tools.

## Consequences

- `extension.ts` currently only shows an information message suggesting
  the branch name on `"started-in-progress"` — it does not create the
  branch or checkout automatically. Wiring that up (e.g. via the
  `simple-git` package or VS Code's Git extension API) is left for a
  later phase, once the "in progress" convention is validated with
  real usage.
- Teams that use a different label than `in-progress` will not trigger
  the hook; this is hardcoded for now rather than made configurable,
  since Phase 4 is explicitly preparatory.

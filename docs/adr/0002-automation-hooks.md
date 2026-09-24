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
gains an optional `onIssueTransition` callback, invoked whenever a
recognized transition is detected on any issue in a freshly fetched
`state`.

**Detection is a diff against the last snapshot this controller sent —
not an immediate before/after pair around a single edit.** The initial
version of this hook fetched the pre-update issue and diffed it against
the post-update result inside the `updateIssue` handler. That could not
actually detect the "in-progress" label in practice: the panel's edit
form has no labels field, so the label is always added externally
(directly on GitHub/GitLab), and both the "before" and "after" fetches
in that flow happen back-to-back at Save time — long after the label was
already added, so neither side ever differs. Diffing against the last
_sent_ snapshot instead means the transition is caught on whatever
`sendState()` call happens next — a manual Refresh, or the state refresh
after any other edit. `PanelController` keeps a `Map<string, IIssue>` of
the last snapshot for exactly this purpose. The first-ever `sendState()`
call establishes the baseline without firing any transitions (there is
nothing to diff against yet).

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

- At the time this ADR was written, `extension.ts` only showed an
  information message suggesting the branch name on
  `"started-in-progress"` — it did not create the branch automatically.
  That automation was completed in ADR-0004.
- Teams that use a different label than `in-progress` will not trigger
  the hook; this is hardcoded rather than made configurable. Revisit if
  teams need a different label vocabulary.
- Because detection diffs against the last snapshot this controller
  sent, a transition is only observed on the _next_ fetch after the
  underlying change — there can be a short delay between an external
  label change and the extension noticing it, bounded by how often the
  panel refetches (see `remoteProjectManager.cacheTtlSeconds` and the
  manual Refresh button, ADR-0003).

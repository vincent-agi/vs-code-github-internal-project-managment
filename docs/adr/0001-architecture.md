# ADR-0001: Extension Architecture and Central Panel Choice

## Status

Accepted

## Context

The extension must show and edit Issues and Milestones from GitHub and GitLab
inside VS Code's main panel. It must support two providers today and stay
open to more providers later, without provider-specific code leaking into
the UI layer.

We need to pick:

1. How to structure the code so business logic stays independent of VS Code
   APIs and of any single provider's SDK.
2. What VS Code UI surface to use for the central panel.

## Decision

### Layering (Clean Architecture)

Three layers, each only depending on the layer inside it:

- `src/core/` — domain layer. Plain TypeScript types and interfaces
  (`IIssue`, `IMilestone`, `IProjectProvider`). No VS Code import, no HTTP
  client import. This layer defines the contract everything else honors.
- `src/providers/` — infrastructure layer. One module per remote platform
  (`github/`, `gitlab/`), each implementing `IProjectProvider`. Owns
  authentication, HTTP/GraphQL calls, and mapping the platform's wire
  format to the domain types.
- `src/webview/` and `src/extension.ts` — presentation layer. Reads and
  writes through `IProjectProvider` only; never imports a provider module
  directly. Provider selection is wired at the composition root
  (`extension.ts`).

This satisfies SOLID's Dependency Inversion: the UI depends on the
`IProjectProvider` abstraction, not on GitHub or GitLab concretes. Adding a
third provider means adding a new `src/providers/<name>/` module and one
line at the composition root — no change to UI or domain code (Open/Closed).

### Central panel: Webview, not Custom Editor

Options considered:

- **TreeView** — fits a read-only list well, but editing issue body/state
  inline needs a richer form; TreeView items are not good at that.
- **Custom Editor** — is built for editing a document backed by a file on
  disk. Issues and Milestones are remote resources with no file
  representation, so this is a mismatch.
- **Webview panel** — full HTML/CSS/JS control, can render a list-plus-detail
  view, and can be opened as an editor-area tab (`vscode.window.createWebviewPanel`
  with `ViewColumn.One`), satisfying "central panel" placement.

Webview panel is chosen. The webview only renders state and sends user
actions as messages; all provider calls happen in the extension host, so the
webview never needs network credentials.

## Consequences

- Every provider must fully implement `IProjectProvider`; partial support
  is not allowed, keeping the abstraction meaningful (Liskov Substitution).
- Webview state and extension host state must be kept in sync explicitly
  via message passing — this is more code than a TreeView, but is required
  for two-way editing.
- Domain types and interfaces are the first thing tested (TDD), since every
  other layer depends on their shape.

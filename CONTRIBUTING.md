# Contributing

This is a VS Code extension. This guide covers building, testing, and packaging it end to end.

## Prerequisites

- Node.js 18 or later.
- `git` on your `PATH` (the auto-branch feature shells out to it).
- A GitHub or GitLab account, for manually testing against a real repository.

## Setup

```bash
npm install
npm run compile
```

`compile` runs two separate `tsc` invocations — see [The webview's no-bundler constraint](#the-webviews-no-bundler-constraint) for why there are two — and is a quick way to confirm both TypeScript projects still build before you dig further.

## Running the extension

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded. To point it at a specific repository without relying on git-remote auto-detection, set `remoteProjectManager.repository` (and `remoteProjectManager.provider`) in that development window's settings.

## Testing

```bash
npm test          # vitest run, once
npm run test:watch
```

Test files live under `test/`, mirroring `src/`'s structure. New logic should come with a colocated test — see any existing file under `test/core/` or `test/providers/` for the pattern.

## Linting and formatting

```bash
npm run lint          # eslint .
npm run format        # prettier --write .
npm run format:check  # prettier --check . — what CI runs
```

`eslint.config.js` runs type-checked rules over `src/**` + `test/**` (against `tsconfig.eslint.json`, a lint-only superset of `tsconfig.json` that also includes `test/`) and separately over `src/webview-ui/**` (against `tsconfig.webview.json`). A couple of rules are turned off specifically for `test/**` where they're well-known vitest mock/matcher false positives — see the comments in `eslint.config.js` before assuming a similar finding elsewhere in `src/` is also a false positive.

## The webview's no-bundler constraint

`src/webview-ui/main.ts` compiles under `tsconfig.webview.json` with `module: "none"` — it ships as a single plain `<script>` tag with no bundler and no real ES module graph, so it **cannot use `import` statements**. Because of that, the message shapes normally defined in `src/webview/messages.ts` and the `hasStateChanged` diff logic in `src/webview-ui/state-diff.ts` are manually mirrored by hand at the top of `main.ts` instead of imported.

This is a deliberate, documented tradeoff (see [ADR-0003](docs/adr/0003-v1-hardening.md)) to avoid introducing a bundler for what's still a fairly small UI. If you change a message type or the diff logic, **update both copies** — don't "fix" the duplication by adding an `import`, it won't compile.

## Packaging

```bash
npm run package
```

Compiles the extension and runs `vsce package`, producing `remote-project-manager-<version>.vsix` in the project root. You may see warnings like `LICENSE not found` — informational, and don't prevent packaging or installing the extension locally; they only matter if you plan to publish to the VS Code Marketplace.

## Where to look next

- [`docs/adr/`](docs/adr/) — architectural decisions and the reasoning behind them.
- [`docs/functionals/`](docs/functionals/INDEX.md) — user-facing behavior, panel by panel.

Check both before re-litigating a design question in a PR — there's a decent chance it's already been settled, with the tradeoffs written down.

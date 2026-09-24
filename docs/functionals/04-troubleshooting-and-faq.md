# Troubleshooting and FAQ

## Rate Limiting and Caching

The extension does not implement a request-budget rate limiter. Instead, it caches issue/milestone/capability reads locally for a short time (`remoteProjectManager.cacheTtlSeconds`, default 180 seconds) to avoid hitting GitHub/GitLab rate limits from repeated fetches.

**How the cache behaves:**

| Situation                                                    | Behavior                                                                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading issues/milestones/capabilities within the TTL window | Served from cache, no API call.                                                                                                               |
| TTL expires                                                  | Next read refetches from the API and repopulates the cache.                                                                                   |
| You edit an issue or milestone in the panel                  | The relevant cache (issues or milestones) is invalidated immediately — you always see your own edit right away, never a stale cached version. |
| You click **Refresh** in the panel toolbar                   | Bypasses the cache for that one fetch, regardless of TTL.                                                                                     |
| Someone else edits the same repository elsewhere             | Not reflected until the TTL expires or you click **Refresh**.                                                                                 |

**If you need fresher data more often:** lower `remoteProjectManager.cacheTtlSeconds` (set to `0` to effectively disable caching — every read hits the API). Be aware this increases API call volume and can bring you closer to GitHub/GitLab's own rate limits.

**If you're hitting an actual `403`/rate-limit error from GitHub or GitLab:** raise `remoteProjectManager.cacheTtlSeconds` instead of lowering it, and use **Refresh** only when you need to.

## Authentication Issues

### GitHub sign-in doesn't appear, or fails

- Confirm you're signed into GitHub in VS Code itself (Accounts icon in the bottom-left, or run **GitHub: Sign in** from the Command Palette) before opening the panel.
- If a previous GitHub session is stale, sign out via the Accounts menu and try opening the panel again — this triggers a fresh `vscode.authentication.getSession` request.

### Resetting a Stored GitLab Token

If your GitLab PAT expired, was revoked, or you want to switch accounts:

1. Run **Remote Project Manager: Sign Out of GitLab** from the Command Palette. This clears the stored token from `SecretStorage` immediately — reloading the window or resetting the extension host does _not_ clear it by itself, since it isn't held in memory.
2. The next time the panel connects to a GitLab repository, you'll be prompted for a new Personal Access Token.
3. Going forward, always confirm the token's scope matches [Authentication and Security](01-authentication-and-security.md#gitlab-personal-access-token-in-secretstorage) before saving it.

### "Operation requires 'canWriteIssues'..." error

Your account has read-only access to this repository. This is not a bug — the panel checks capabilities before every write and blocks the request rather than sending it and getting a silent failure. Ask a repository admin for write access, or use the panel in a read-only capacity.

## Git and Branch Creation Issues

### "Could not create branch: ..." after a merge conflict

**Force Switch** on a dirty working tree lets git attempt to carry your uncommitted changes onto the new branch. If a file you've modified also differs between your current branch and the new branch's base, git refuses the checkout with a conflict error, which the extension surfaces verbatim. Resolve it the normal way:

1. Commit or stash your current changes manually (`git stash` or `git commit`).
2. Retry moving the issue to "in-progress," or create the branch manually with the name shown in the earlier suggestion message.

### "Could not determine the default branch (tried main, master, devel)"

The extension looks for `origin`'s `HEAD` symbolic ref first, then falls back to checking whether `main`, `master`, or `devel` exist on `origin`. If your repository's default branch has a different name, this fails. Fix it by setting the remote's HEAD correctly:

```bash
git remote set-head origin -a
```

### "Generated branch name '...' is not a valid git ref"

Usually means a custom `remoteProjectManager.branchNamePattern` produces something git rejects — for example, a pattern with a literal space, or `${slug}` used inside a segment that also contains `..`. Check the pattern against the placeholder rules in [Automated Branch Workflow](03-automated-branch-workflow.md#branch-name-pattern), and remember `${slug}` is already sanitized — the problem is almost always in the literal parts of your custom pattern.

### No branch is created, and no message appears

Check, in order:

1. Is `remoteProjectManager.autoBranchOnInProgress` `true`?
2. Are you actually one of the issue's assignees (case doesn't matter, but the username must match exactly)?
3. Did the "in-progress" label change happen _before_ your last panel refresh? The extension only detects a transition on the fetch _after_ the label changes — click **Refresh** if you just added the label externally. See [Issues and Milestones Management](02-issues-and-milestones-management.md#moving-an-issue-to-in-progress).
4. Is the repository resolved to a workspace folder? An explicit `remoteProjectManager.repository` setting with no workspace folder open has no `cwd` to run git in — you'll see the suggestion message instead of automatic creation.

## Repository Detection Issues

### "No GitHub/GitLab repository detected in this workspace"

The extension recognizes `origin` remotes on `github.com`, `gitlab.com`, and — once `remoteProjectManager.gitlabHost` is set — one self-hosted GitLab host (SSH, `ssh://`, or `https://`). This fails when:

- The workspace has no `origin` remote configured (`git remote -v` shows nothing, or a name other than `origin`).
- The repository is on a **self-hosted GitLab instance** (e.g. `gitlab.example.com`) and `remoteProjectManager.gitlabHost` isn't set to that host.
- No workspace folder is open at all.

**Fix:** set `remoteProjectManager.repository` (and `remoteProjectManager.provider`) manually in your settings, or — for a self-hosted GitLab instance — set `remoteProjectManager.gitlabHost` to its hostname (e.g. `gitlab.example.com`) so it's both auto-detected and used as the API host.

### The picker shows a repository I didn't expect

The picker lists every workspace folder whose `origin` remote resolves to a recognized host — including folders you might not think of as "the project" (e.g. a submodule or a docs-only checkout). Pick the correct one; your choice isn't persisted across panel sessions, so you'll see the picker again next time if multiple folders still match.

## Packaging and Installation

### Building a `.vsix` for "Install from VSIX"

Run:

```bash
npm run package
```

This compiles the extension and runs `vsce package`, producing `remote-project-manager-<version>.vsix`. You may see warnings like `LICENSE not found` — these are informational and do not prevent packaging or installing the extension locally; they only matter if you plan to publish to the VS Code Marketplace.

### The VSIX is large / includes unexpected files

Check `.vscodeignore` at the project root — it excludes `src/`, `test/`, ADR docs, and TypeScript configs from the package. If you add new top-level source directories, add them there too.

import type { ProviderKind } from "../models/issue.model";

/** A remote URL parsed into the provider and repository it points at. */
export interface ParsedRemote {
  readonly provider: ProviderKind;
  readonly repository: string;
}

/** A workspace folder whose `origin` remote resolved to a known provider. */
export interface RepositoryCandidate {
  readonly folderPath: string;
  readonly folderName: string;
  readonly provider: ProviderKind;
  readonly repository: string;
}

/** A workspace folder paired with its `origin` remote URL, if any. */
export interface FolderRemote {
  readonly folderPath: string;
  readonly folderName: string;
  readonly remoteUrl: string | null;
}

function mapHostToProvider(host: string, gitlabHost?: string): ProviderKind | null {
  if (host === "github.com") {
    return "github";
  }
  if (host === "gitlab.com") {
    return "gitlab";
  }
  if (gitlabHost && host === gitlabHost) {
    return "gitlab";
  }
  return null;
}

function parsePath(pathname: string): { owner: string; repo: string } | null {
  const segments = pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const [owner, repo] = segments;
  return { owner, repo };
}

/**
 * Parses a git remote URL (SSH scp-like, `ssh://`, or `https://`, with or
 * without a trailing `.git`) into a provider and `"owner/repo"` string.
 * `github.com` and `gitlab.com` are always recognized; pass `gitlabHost`
 * (from `remoteProjectManager.gitlabHost`) to also recognize a
 * self-hosted GitLab instance (see ADR-0003).
 *
 * @returns The parsed remote, or null if the URL is malformed or points
 * at an unrecognized host.
 */
export function parseGitRemoteUrl(rawUrl: string, gitlabHost?: string): ParsedRemote | null {
  const url = rawUrl.trim().replace(/\.git$/, "");

  if (url.includes("://")) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const path = parsePath(parsed.pathname);
    const provider = path && mapHostToProvider(parsed.hostname, gitlabHost);
    return provider && path ? { provider, repository: `${path.owner}/${path.repo}` } : null;
  }

  const scpMatch = url.match(/^(?:[^@\s]+@)?([^:\s]+):(.+)$/);
  if (!scpMatch) {
    return null;
  }
  const [, host, path] = scpMatch;
  const parsedPath = parsePath(path);
  const provider = parsedPath && mapHostToProvider(host, gitlabHost);
  return provider && parsedPath
    ? { provider, repository: `${parsedPath.owner}/${parsedPath.repo}` }
    : null;
}

/**
 * Resolves which workspace folders point at a recognized GitHub/GitLab
 * repository, for the multi-root workspace picker. Folders with no
 * remote, or a remote on an unrecognized host, are silently skipped.
 * Pass `gitlabHost` to also recognize a self-hosted GitLab instance.
 */
export function resolveRepositoryCandidates(
  folders: readonly FolderRemote[],
  gitlabHost?: string,
): RepositoryCandidate[] {
  const candidates: RepositoryCandidate[] = [];
  for (const folder of folders) {
    if (!folder.remoteUrl) {
      continue;
    }
    const parsed = parseGitRemoteUrl(folder.remoteUrl, gitlabHost);
    if (!parsed) {
      continue;
    }
    candidates.push({
      folderPath: folder.folderPath,
      folderName: folder.folderName,
      provider: parsed.provider,
      repository: parsed.repository,
    });
  }
  return candidates;
}

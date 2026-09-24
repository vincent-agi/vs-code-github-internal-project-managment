import type { IIssue } from "../models/issue.model";

const MAX_SLUG_LENGTH = 50;
const DEFAULT_PATTERN = "${type}/${issue_id}-${slug}";
const DEFAULT_PATTERN_NO_SLUG = "${type}/${issue_id}";

/** Label (lowercased) -> branch type token, checked in order. */
const LABEL_TYPE_MAP: ReadonlyArray<readonly [string, string]> = [
  ["bug", "fix"],
  ["enhancement", "feature"],
  ["feature", "feature"],
  ["documentation", "docs"],
  ["docs", "docs"],
  ["chore", "chore"],
];

/**
 * Converts accented/diacritic characters to their closest ASCII
 * equivalent (e.g. `é` -> `e`), then removes anything left that isn't
 * `[a-z0-9]`, lowercases, hyphenates, and truncates to
 * {@link MAX_SLUG_LENGTH} characters without a trailing hyphen.
 */
export function slugify(title: string): string {
  const ascii = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Infers a conventional branch type token from an issue's labels (e.g.
 * "bug" -> "fix"), falling back to "issue" when no label matches. Label
 * matching is case-insensitive and checked in a fixed priority order.
 */
export function inferBranchType(issue: IIssue): string {
  const labels = issue.labels.map((label) => label.toLowerCase());
  for (const [label, type] of LABEL_TYPE_MAP) {
    if (labels.includes(label)) {
      return type;
    }
  }
  return "issue";
}

/**
 * Fills `${type}`, `${issue_id}`, and `${slug}` placeholders in a branch
 * name pattern.
 */
function fillPattern(
  pattern: string,
  vars: { type: string; issue_id: string; slug: string },
): string {
  return pattern
    .replace(/\$\{type\}/g, vars.type)
    .replace(/\$\{issue_id\}/g, vars.issue_id)
    .replace(/\$\{slug\}/g, vars.slug);
}

/**
 * Generates a `git checkout -b`-ready branch name for an issue, using a
 * configurable pattern (default `${type}/${issue_id}-${slug}`, matching
 * `remoteProjectManager.branchNamePattern`). When the title has no
 * usable characters, the `-${slug}` portion is dropped entirely rather
 * than left dangling.
 */
export function generateBranchName(issue: IIssue, pattern: string = DEFAULT_PATTERN): string {
  const slug = slugify(issue.title);
  const type = inferBranchType(issue);
  const issueId = String(issue.number);

  if (!slug) {
    const noSlugPattern =
      pattern === DEFAULT_PATTERN ? DEFAULT_PATTERN_NO_SLUG : pattern.replace(/-?\$\{slug\}/g, "");
    return fillPattern(noSlugPattern, { type, issue_id: issueId, slug: "" });
  }

  return fillPattern(pattern, { type, issue_id: issueId, slug });
}

/**
 * A fast, dependency-free pre-check against git's ref-name rules
 * (see `git help check-ref-format`). This is a first line of defense
 * before the authoritative check — spawning `git check-ref-format
 * --branch` via {@link IGitService} — not a full reimplementation of it.
 */
export function looksLikeValidGitRef(name: string): boolean {
  if (name.length === 0) {
    return false;
  }
  if (/\s/.test(name)) {
    return false;
  }
  if (name.includes("..")) {
    return false;
  }
  if (/[~^:?*[\]\\]/.test(name)) {
    return false;
  }
  if (name.startsWith("/") || name.endsWith("/") || name.startsWith(".") || name.endsWith(".")) {
    return false;
  }
  if (name.endsWith(".lock")) {
    return false;
  }
  if (name.includes("//")) {
    return false;
  }
  return true;
}

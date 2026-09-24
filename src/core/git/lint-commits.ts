import { extractIssueNumberFromCommitMessage } from "./commit-issue-ref";
import {
  buildCommitMessage,
  COMMIT_TYPES,
  GITMOJI_PATTERN_SOURCE,
  validateCommitMessage,
  type CommitType,
} from "./commit-message";
import type { CommitRef } from "./pr-body";

/** Default Gitmoji to suggest for each Conventional Commits type. */
const DEFAULT_GITMOJI_FOR_TYPE: Record<CommitType, string> = {
  feat: "✨",
  fix: "🐛",
  docs: "📝",
  style: "💄",
  refactor: "♻️",
  perf: "📈",
  test: "✅",
  build: "📦️",
  ci: "👷",
  chore: "🔧",
  revert: "⏪️",
};

/** Heuristics mapping common non-conventional prefixes to a commit type. */
const TYPE_ALIASES: ReadonlyArray<readonly [RegExp, CommitType]> = [
  [/^fix(ed|es)?\b/i, "fix"],
  [/^bug\b/i, "fix"],
  [/^add(ed|s)?\b/i, "feat"],
  [/^feat(ure)?\b/i, "feat"],
  [/^remove[ds]?\b/i, "refactor"],
  [/^refactor(ed|ing)?\b/i, "refactor"],
  [/^update[ds]?\b/i, "chore"],
  [/^doc(s|umentation)?\b/i, "docs"],
  [/^test(s|ed|ing)?\b/i, "test"],
  [/^perf(ormance)?\b/i, "perf"],
  [/^style\b/i, "style"],
  [/^ci\b/i, "ci"],
  [/^build\b/i, "build"],
  [/^revert(ed)?\b/i, "revert"],
];

/** Best-effort inference of a Conventional Commits type from a free-form subject line. */
function inferType(subject: string): CommitType {
  for (const [pattern, type] of TYPE_ALIASES) {
    if (pattern.test(subject)) {
      return type;
    }
  }
  const lower = subject.toLowerCase();
  const knownType = COMMIT_TYPES.find((type) => lower.startsWith(type));
  return knownType ?? "chore";
}

/** Strips a leading `type(scope):`/`type:` and/or gitmoji token, if present, to recover a bare description. */
const GITMOJI_PREFIX_PATTERN = new RegExp(`^(:[a-z0-9_+-]+:|${GITMOJI_PATTERN_SOURCE})\\s*`, "u");

function stripKnownPrefix(subject: string): string {
  const withoutType = subject.replace(/^[a-zA-Z]+(\([\w./-]+\))?:\s*/, "");
  const withoutGitmoji = withoutType.replace(GITMOJI_PREFIX_PATTERN, "");
  return withoutGitmoji.trim();
}

/** The outcome of linting a single commit against the Gitmoji/Conventional Commit convention. */
export interface CommitLintResult {
  readonly hash: string;
  readonly message: string;
  readonly valid: boolean;
  readonly reason?: string;
  /**
   * A best-effort corrected message, present only when `valid` is false.
   * Never applied automatically — callers surface it for the user to
   * copy into an `amend`/future commit, never to rewrite history.
   */
  readonly suggestion?: string;
}

/**
 * Lints a list of commits against the convention enforced by
 * {@link validateCommitMessage}, reusing it rather than re-implementing
 * the check. Non-compliant commits get a best-effort `suggestion`:
 * inferred type, a default Gitmoji for that type, the description with
 * any recognizable existing prefix stripped, and the original issue
 * reference (if any) preserved as a `Refs #N` trailer.
 */
export function lintCommits(commits: readonly CommitRef[]): CommitLintResult[] {
  return commits.map((commit) => {
    const result = validateCommitMessage(commit.message);
    if (result.valid) {
      return { hash: commit.hash, message: commit.message, valid: true };
    }

    const subject = commit.message.split("\n")[0] ?? "";
    const type = inferType(subject);
    const description = stripKnownPrefix(subject) || subject.trim() || "update";
    const issueNumber = extractIssueNumberFromCommitMessage(commit.message) ?? undefined;
    const suggestion = buildCommitMessage({
      type,
      gitmoji: DEFAULT_GITMOJI_FOR_TYPE[type],
      description,
      issueNumber,
      issueReferenceKind: issueNumber !== undefined ? "refs" : "none",
    });

    return {
      hash: commit.hash,
      message: commit.message,
      valid: false,
      reason: result.reason,
      suggestion,
    };
  });
}

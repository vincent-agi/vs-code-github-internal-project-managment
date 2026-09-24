const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

/** A Conventional Commits type token. */
export type CommitType = (typeof CONVENTIONAL_TYPES)[number];

/** All supported Conventional Commits type tokens, in a fixed display order. */
export const COMMIT_TYPES: readonly CommitType[] = CONVENTIONAL_TYPES;

/** How the current issue should be referenced in a composed commit message. */
export type IssueReferenceKind = "fixes" | "refs" | "none";

/** Inputs used to compose a standardized commit message. */
export interface CommitMessageInput {
  readonly type: string;
  readonly scope?: string;
  /** Either a raw emoji (e.g. "✨") or its `:code:` form (e.g. ":sparkles:"). */
  readonly gitmoji: string;
  readonly description: string;
  readonly issueNumber?: number;
  readonly issueReferenceKind?: IssueReferenceKind;
}

/**
 * Composes a commit message matching
 * `<type>(<scope>): <gitmoji> <description> (#<issue_id>)`. `scope` and
 * the issue reference are both optional: dropping either collapses the
 * corresponding `(...)` group entirely rather than leaving it empty.
 *
 * The issue reference, when present, is emitted as a trailing `Fixes #N`
 * / `Refs #N` line in the body rather than inline in the subject, per
 * GitHub's closing-keyword convention — except `"none"`, or when
 * `issueNumber` is absent, which omits it entirely.
 */
export function buildCommitMessage(input: CommitMessageInput): string {
  const scopePart = input.scope ? `(${input.scope})` : "";
  const subject = `${input.type}${scopePart}: ${input.gitmoji} ${input.description}`.trim();

  const kind = input.issueReferenceKind ?? "none";
  if (kind === "none" || input.issueNumber === undefined) {
    return subject;
  }
  const keyword = kind === "fixes" ? "Fixes" : "Refs";
  return `${subject}\n\n${keyword} #${input.issueNumber}`;
}

/** Result of validating a commit message's subject line against the convention. */
export interface CommitValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

/**
 * Matches `<type>(<scope>): <gitmoji> <description>`, with `(<scope>)`
 * optional. The gitmoji may be a raw emoji codepoint or a `:code:` token,
 * so messages composed by hand (without the interactive picker) still
 * validate.
 */
const COMMIT_SUBJECT_PATTERN =
  /^[a-z]+(\([\w./-]+\))?: (:[a-z0-9_+-]+:|\p{Extended_Pictographic}) .+$/u;

/**
 * Validates a commit message's subject line (its first line) against the
 * `<type>(<scope>): <gitmoji> <description>` convention. Only the type
 * token's *shape* is checked here (lowercase word) — reused, unrelated
 * validation of it being a recognized Conventional Commits type is left
 * to callers that care (e.g. the interactive composer, which only offers
 * {@link COMMIT_TYPES} in the first place).
 */
export function validateCommitMessage(message: string): CommitValidationResult {
  const subject = (message.split("\n")[0] ?? "").trim();
  if (!subject) {
    return { valid: false, reason: "Commit message is empty." };
  }
  if (!COMMIT_SUBJECT_PATTERN.test(subject)) {
    return {
      valid: false,
      reason: "Doesn't match '<type>(<scope>): <gitmoji> <description>'.",
    };
  }
  return { valid: true };
}

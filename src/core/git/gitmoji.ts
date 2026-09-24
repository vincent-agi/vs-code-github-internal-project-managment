/** A single Gitmoji entry from the bundled reference list. */
export interface Gitmoji {
  readonly emoji: string;
  readonly code: string;
  readonly description: string;
}

function isGitmoji(value: unknown): value is Gitmoji {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.emoji === "string" &&
    typeof candidate.code === "string" &&
    typeof candidate.description === "string"
  );
}

/**
 * Validates and narrows the raw JSON parsed from `resources/gitmojis.json`
 * into a {@link Gitmoji} list. Kept separate from the file read itself
 * (an I/O concern handled by the VS Code extension host) so this parsing
 * step is unit-testable without a filesystem.
 */
export function parseGitmojis(raw: unknown): Gitmoji[] {
  if (!Array.isArray(raw)) {
    throw new Error("Gitmoji list must be a JSON array.");
  }
  const entries = raw.filter(isGitmoji);
  if (entries.length === 0) {
    throw new Error("Gitmoji list is empty or malformed.");
  }
  return entries;
}

/** Finds a Gitmoji by its `:code:` token (case-sensitive, as gitmoji codes are). */
export function findGitmojiByCode(gitmojis: readonly Gitmoji[], code: string): Gitmoji | undefined {
  return gitmojis.find((entry) => entry.code === code);
}

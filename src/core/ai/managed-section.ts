function startMarker(sectionName: string): string {
  return `<!-- remote-project-manager:${sectionName}:start -->`;
}

function endMarker(sectionName: string): string {
  return `<!-- remote-project-manager:${sectionName}:end -->`;
}

/**
 * Replaces (or appends) an extension-managed section of a Markdown file,
 * identified by an HTML comment marker pair, without touching anything
 * else in the file. This is what makes the AI context export idempotent
 * and safe to re-run against a file the user may also hand-edit (e.g.
 * `.github/copilot-instructions.md`): re-exporting only ever replaces
 * the content between `<!-- remote-project-manager:<sectionName>:start
 * -->` and `...:end -->`, appending that block (with a leading blank
 * line separator) when the markers aren't present yet.
 */
export function replaceManagedSection(
  existingContent: string,
  sectionName: string,
  block: string,
): string {
  const start = startMarker(sectionName);
  const end = endMarker(sectionName);
  const managed = `${start}\n${block.trim()}\n${end}`;

  const startIndex = existingContent.indexOf(start);
  const endIndex = existingContent.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    const separator = existingContent.trim() ? "\n\n" : "";
    return `${existingContent.trimEnd()}${separator}${managed}\n`;
  }

  const before = existingContent.slice(0, startIndex);
  const after = existingContent.slice(endIndex + end.length);
  return `${before}${managed}${after}`;
}

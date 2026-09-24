import type { IIssue } from "../models/issue.model";
import type { IMilestone } from "../models/milestone.model";

/**
 * Extracts GitHub/GitLab-style task-list items (`- [ ] ...` / `- [x] ...`)
 * from an issue body, in source order, each tagged with its checked
 * state. Returns an empty array when the body has no such items —
 * callers omit the "Acceptance Criteria" section entirely in that case
 * rather than rendering an empty list.
 */
export function parseAcceptanceCriteria(
  body: string,
): ReadonlyArray<{ text: string; checked: boolean }> {
  const pattern = /^\s*-\s*\[( |x|X)\]\s*(.+)$/gm;
  const items: Array<{ text: string; checked: boolean }> = [];
  for (const match of body.matchAll(pattern)) {
    items.push({ checked: match[1].toLowerCase() === "x", text: match[2].trim() });
  }
  return items;
}

/**
 * Serializes an issue (title, body, milestone, acceptance criteria) into
 * a structured Markdown block meant to be handed directly to an AI
 * coding agent (Copilot Chat, Claude Code, Continue.dev, ...) as context.
 * Shared by the "copy issue context" command and the milestone Markdown
 * export, so both stay in sync.
 */
export function formatIssueContext(issue: IIssue, milestone?: IMilestone | null): string {
  const lines: string[] = [];
  lines.push(`### #${issue.number} ${issue.title}`);
  lines.push("");
  lines.push(`- State: ${issue.state}`);
  if (issue.labels.length > 0) {
    lines.push(`- Labels: ${issue.labels.join(", ")}`);
  }
  lines.push(`- Milestone: ${milestone ? milestone.title : "none"}`);
  lines.push(`- URL: ${issue.url}`);
  lines.push("");

  if (issue.body.trim()) {
    lines.push(issue.body.trim());
    lines.push("");
  }

  const criteria = parseAcceptanceCriteria(issue.body);
  if (criteria.length > 0) {
    lines.push("**Acceptance Criteria**");
    for (const item of criteria) {
      lines.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

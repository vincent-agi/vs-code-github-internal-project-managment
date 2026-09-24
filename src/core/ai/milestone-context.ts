import { formatIssueContext } from "./issue-context";
import type { IIssue } from "../models/issue.model";
import type { IMilestone } from "../models/milestone.model";

/**
 * Serializes a milestone and its issues into a structured Markdown
 * summary for AI agents (`.github/copilot-instructions.md`,
 * `.claudecode/context.md`, ...): the milestone's title/description/due
 * date, followed by each issue's context, reusing
 * {@link formatIssueContext} so both this export and the "copy issue
 * context" command render issues identically.
 */
export function formatMilestoneContext(milestone: IMilestone, issues: readonly IIssue[]): string {
  const lines: string[] = [];
  lines.push(`## Milestone: ${milestone.title}`);
  lines.push("");
  lines.push(`- State: ${milestone.state}`);
  lines.push(`- Due: ${milestone.dueOn ?? "none"}`);
  lines.push(`- URL: ${milestone.url}`);
  lines.push("");
  if (milestone.description.trim()) {
    lines.push(milestone.description.trim());
    lines.push("");
  }

  if (issues.length > 0) {
    lines.push("### Issues");
    lines.push("");
    for (const issue of issues) {
      lines.push(formatIssueContext(issue, milestone));
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

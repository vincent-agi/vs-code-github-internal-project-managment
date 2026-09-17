import { detectIssueTransition, type IssueTransition } from "../core/automation/issue-transition";
import type { IIssue } from "../core/models/issue.model";
import type { FetchOptions, IProjectProvider, UpdateIssueInput } from "../core/providers/project-provider.interface";
import { assertCanWrite } from "../core/providers/project-provider.interface";
import type { InboundMessage, OutboundMessage } from "./messages";

/** Called when an issue update crosses a recognized lifecycle transition. */
export type IssueTransitionHandler = (issue: IIssue, transition: IssueTransition) => void;

/**
 * Drives the central panel's state: fetches issues/milestones/capabilities
 * from an {@link IProjectProvider} and applies webview-initiated edits,
 * enforcing write permissions before any mutation. Framework-agnostic —
 * `postMessage` is the only side-effecting dependency, so this can be
 * unit tested without a real VS Code webview.
 *
 * `onIssueTransition` is Phase 4's automation hook: it fires on
 * recognized lifecycle changes (e.g. an issue closing, or picking up the
 * "in-progress" label) so future automation, like auto-creating a branch,
 * can subscribe without this class knowing about branches or git.
 */
export class PanelController {
  constructor(
    private readonly provider: IProjectProvider,
    private readonly postMessage: (message: OutboundMessage) => void,
    private readonly onIssueTransition?: IssueTransitionHandler,
  ) {}

  async handleMessage(message: InboundMessage): Promise<void> {
    try {
      switch (message.type) {
        case "requestState":
          await this.sendState(message.forceRefresh ? { forceRefresh: true } : undefined);
          return;
        case "createIssue":
          await this.guardWrite("canWriteIssues");
          await this.provider.createIssue(message.input);
          await this.sendState();
          return;
        case "updateIssue":
          await this.guardWrite("canWriteIssues");
          await this.updateIssueAndNotify(message.id, message.patch);
          await this.sendState();
          return;
        case "createMilestone":
          await this.guardWrite("canWriteMilestones");
          await this.provider.createMilestone(message.input);
          await this.sendState();
          return;
        case "updateMilestone":
          await this.guardWrite("canWriteMilestones");
          await this.provider.updateMilestone(message.id, message.patch);
          await this.sendState();
          return;
      }
    } catch (error) {
      this.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  private async updateIssueAndNotify(id: string, patch: UpdateIssueInput): Promise<void> {
    if (!this.onIssueTransition) {
      await this.provider.updateIssue(id, patch);
      return;
    }

    const before = await this.provider.getIssue(id);
    const after = await this.provider.updateIssue(id, patch);
    const transition = detectIssueTransition(before, after);
    if (transition !== "none") {
      this.onIssueTransition(after, transition);
    }
  }

  private async guardWrite(permission: "canWriteIssues" | "canWriteMilestones"): Promise<void> {
    const capabilities = await this.provider.getCapabilities();
    assertCanWrite(capabilities, permission);
  }

  private async sendState(options?: FetchOptions): Promise<void> {
    const [capabilities, issues, milestones] = await Promise.all([
      this.provider.getCapabilities(options),
      this.provider.listIssues(options),
      this.provider.listMilestones(options),
    ]);
    this.postMessage({ type: "state", issues, milestones, capabilities });
  }
}

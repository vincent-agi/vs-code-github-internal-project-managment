import { detectIssueTransition, type IssueTransition } from "../core/automation/issue-transition";
import type { IIssue } from "../core/models/issue.model";
import type { FetchOptions, IProjectProvider } from "../core/providers/project-provider.interface";
import { assertCanWrite } from "../core/providers/project-provider.interface";
import type { InboundMessage, OutboundMessage } from "./messages";

/** Called when an issue update crosses a recognized lifecycle transition. */
export type IssueTransitionHandler = (issue: IIssue, transition: IssueTransition) => void;

/**
 * Called when the webview asks to create (and switch to) a branch for an
 * issue. Resolves to a success message to toast, or `null` when the user
 * cancelled (e.g. backed out of the base-branch picker or the dirty-tree
 * prompt) and nothing should be shown. Throws to report a failure, which
 * `handleMessage`'s catch turns into an `error` message.
 */
export type CreateBranchRequestHandler = (issue: IIssue) => Promise<string | null>;

/**
 * Drives the central panel's state: fetches issues/milestones/capabilities
 * from an {@link IProjectProvider} and applies webview-initiated edits,
 * enforcing write permissions before any mutation. Framework-agnostic —
 * `postMessage` is the only side-effecting dependency, so this can be
 * unit tested without a real VS Code webview.
 *
 * `onIssueTransition` is the automation hook: it fires on recognized
 * lifecycle changes (e.g. an issue closing, or picking up the
 * "in-progress" label) so automation like auto-creating a branch can
 * subscribe without this class knowing about branches or git.
 *
 * Transitions are detected by diffing each freshly fetched issue against
 * the *last state snapshot this controller sent*, not an immediate
 * before/after pair around a single edit. This matters: the panel's edit
 * form has no labels field, so the "in-progress" label is always added
 * externally (directly on GitHub/GitLab). Diffing against the last
 * snapshot means it fires on the next fetch — a manual Refresh, or the
 * `sendState()` after any other edit — instead of never firing at all.
 */
export class PanelController {
  private lastIssuesById: Map<string, IIssue> | null = null;

  constructor(
    private readonly provider: IProjectProvider,
    private readonly postMessage: (message: OutboundMessage) => void,
    private readonly onIssueTransition?: IssueTransitionHandler,
    private readonly onCreateBranchRequest?: CreateBranchRequestHandler,
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
          this.postMessage({ type: "actionSuccess", message: "Issue created." });
          await this.sendState();
          return;
        case "updateIssue":
          await this.guardWrite("canWriteIssues");
          await this.provider.updateIssue(message.id, message.patch);
          this.postMessage({ type: "actionSuccess", message: "Issue updated." });
          await this.sendState();
          return;
        case "createMilestone":
          await this.guardWrite("canWriteMilestones");
          await this.provider.createMilestone(message.input);
          this.postMessage({ type: "actionSuccess", message: "Milestone created." });
          await this.sendState();
          return;
        case "updateMilestone":
          await this.guardWrite("canWriteMilestones");
          await this.provider.updateMilestone(message.id, message.patch);
          this.postMessage({ type: "actionSuccess", message: "Milestone updated." });
          await this.sendState();
          return;
        case "createBranchForIssue": {
          if (!this.onCreateBranchRequest) {
            return;
          }
          const issue = this.lastIssuesById?.get(message.id);
          if (!issue) {
            this.postMessage({ type: "error", message: "Issue not found." });
            return;
          }
          const successMessage = await this.onCreateBranchRequest(issue);
          if (successMessage) {
            this.postMessage({ type: "actionSuccess", message: successMessage });
          }
          return;
        }
      }
    } catch (error) {
      this.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  private async guardWrite(permission: "canWriteIssues" | "canWriteMilestones"): Promise<void> {
    const capabilities = await this.provider.getCapabilities();
    assertCanWrite(capabilities, permission);
  }

  private detectAndNotifyTransitions(issues: readonly IIssue[]): void {
    const previousById = this.lastIssuesById;
    this.lastIssuesById = new Map(issues.map((issue) => [issue.id, issue]));

    if (!previousById || !this.onIssueTransition) {
      return;
    }

    for (const issue of issues) {
      const previous = previousById.get(issue.id);
      if (!previous) {
        continue;
      }
      const transition = detectIssueTransition(previous, issue);
      if (transition !== "none") {
        this.onIssueTransition(issue, transition);
      }
    }
  }

  private async sendState(options?: FetchOptions): Promise<void> {
    const [capabilities, issues, milestones, currentUser, availableLabels, availableAssignableUsers] =
      await Promise.all([
        this.provider.getCapabilities(options),
        this.provider.listIssues(options),
        this.provider.listMilestones(options),
        this.provider.getCurrentUser(),
        this.provider.listLabels(options),
        this.provider.listAssignableUsers(options),
      ]);
    this.detectAndNotifyTransitions(issues);
    this.postMessage({
      type: "state",
      issues,
      milestones,
      capabilities,
      currentUser,
      availableLabels,
      availableAssignableUsers,
    });
  }
}

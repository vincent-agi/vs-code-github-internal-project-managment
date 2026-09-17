import type { IProjectProvider } from "../core/providers/project-provider.interface";
import { assertCanWrite } from "../core/providers/project-provider.interface";
import type { InboundMessage, OutboundMessage } from "./messages";

/**
 * Drives the central panel's state: fetches issues/milestones/capabilities
 * from an {@link IProjectProvider} and applies webview-initiated edits,
 * enforcing write permissions before any mutation. Framework-agnostic —
 * `postMessage` is the only side-effecting dependency, so this can be
 * unit tested without a real VS Code webview.
 */
export class PanelController {
  constructor(
    private readonly provider: IProjectProvider,
    private readonly postMessage: (message: OutboundMessage) => void,
  ) {}

  async handleMessage(message: InboundMessage): Promise<void> {
    try {
      switch (message.type) {
        case "requestState":
          await this.sendState();
          return;
        case "createIssue":
          await this.guardWrite("canWriteIssues");
          await this.provider.createIssue(message.input);
          await this.sendState();
          return;
        case "updateIssue":
          await this.guardWrite("canWriteIssues");
          await this.provider.updateIssue(message.id, message.patch);
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

  private async guardWrite(permission: "canWriteIssues" | "canWriteMilestones"): Promise<void> {
    const capabilities = await this.provider.getCapabilities();
    assertCanWrite(capabilities, permission);
  }

  private async sendState(): Promise<void> {
    const [capabilities, issues, milestones] = await Promise.all([
      this.provider.getCapabilities(),
      this.provider.listIssues(),
      this.provider.listMilestones(),
    ]);
    this.postMessage({ type: "state", issues, milestones, capabilities });
  }
}

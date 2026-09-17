import type { IIssue } from "../core/models/issue.model";
import type { IMilestone } from "../core/models/milestone.model";
import type {
  CreateIssueInput,
  CreateMilestoneInput,
  ProviderCapabilities,
  UpdateIssueInput,
  UpdateMilestoneInput,
} from "../core/providers/project-provider.interface";

/** Messages the webview sends to the extension host. */
export type InboundMessage =
  | { readonly type: "requestState" }
  | { readonly type: "updateIssue"; readonly id: string; readonly patch: UpdateIssueInput }
  | { readonly type: "createIssue"; readonly input: CreateIssueInput }
  | { readonly type: "updateMilestone"; readonly id: string; readonly patch: UpdateMilestoneInput }
  | { readonly type: "createMilestone"; readonly input: CreateMilestoneInput };

/** Messages the extension host sends to the webview. */
export type OutboundMessage =
  | {
      readonly type: "state";
      readonly issues: readonly IIssue[];
      readonly milestones: readonly IMilestone[];
      readonly capabilities: ProviderCapabilities;
    }
  | { readonly type: "error"; readonly message: string };

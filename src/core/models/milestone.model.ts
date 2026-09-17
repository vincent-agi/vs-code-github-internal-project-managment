import type { ProviderKind } from "./issue.model";

/** Lifecycle state of a milestone, normalized across providers. */
export type MilestoneState = "open" | "closed";

const MILESTONE_STATES: readonly MilestoneState[] = ["open", "closed"];

/**
 * Type guard for {@link MilestoneState}.
 *
 * @param value - Value to check, typically raw provider input.
 * @returns True if value is a valid {@link MilestoneState}.
 */
export function isMilestoneState(value: unknown): value is MilestoneState {
  return typeof value === "string" && (MILESTONE_STATES as string[]).includes(value);
}

/**
 * A domain-level representation of a milestone, independent of any specific
 * remote provider's wire format.
 */
export interface IMilestone {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly state: MilestoneState;
  /** ISO 8601 due date, or null if none is set. */
  readonly dueOn: string | null;
  readonly url: string;
  readonly provider: ProviderKind;
}

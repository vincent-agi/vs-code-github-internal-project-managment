import type { IIssue } from "../models/issue.model";

/** How the user chose to handle a dirty working tree. */
export type DirtyTreeDecision = "cancel" | "stash" | "force";

/** Callbacks the caller supplies to resolve situations BranchManager can't decide on its own. */
export interface BranchCreationPrompts {
  /** Called when the working tree has uncommitted changes; resolves to the user's choice. */
  onDirtyWorkingTree(): Promise<DirtyTreeDecision>;
}

/** Outcome of an attempted branch creation. */
export type BranchCreationResult =
  | { readonly status: "created"; readonly branchName: string }
  | { readonly status: "cancelled" }
  | { readonly status: "invalid-name"; readonly branchName: string }
  | { readonly status: "error"; readonly message: string };

/**
 * Orchestrates safely creating and checking out a branch for an issue:
 * name generation + validation, dirty-tree handling, and basing the new
 * branch on an up-to-date default branch. See ADR-0004.
 */
export interface IBranchManager {
  createBranchForIssue(
    issue: IIssue,
    cwd: string,
    prompts: BranchCreationPrompts,
    pattern?: string,
  ): Promise<BranchCreationResult>;
}

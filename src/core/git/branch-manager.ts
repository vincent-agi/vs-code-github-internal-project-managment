import { generateBranchName, looksLikeValidGitRef } from "../automation/branch-name";
import type { IIssue } from "../models/issue.model";
import type {
  BranchCreationPrompts,
  BranchCreationResult,
  IBranchManager,
} from "./branch-manager.interface";
import type { IGitService } from "./git-service.interface";

/**
 * {@link IBranchManager} implementation. Fully testable against a fake
 * {@link IGitService}: no git process is spawned by this class directly.
 */
export class BranchManager implements IBranchManager {
  constructor(private readonly git: IGitService) {}

  async createBranchForIssue(
    issue: IIssue,
    cwd: string,
    prompts: BranchCreationPrompts,
    pattern?: string,
  ): Promise<BranchCreationResult> {
    const branchName = generateBranchName(issue, pattern);

    if (!looksLikeValidGitRef(branchName)) {
      return { status: "invalid-name", branchName };
    }
    if (!(await this.git.isValidBranchName(branchName))) {
      return { status: "invalid-name", branchName };
    }

    const status = await this.git.getStatus(cwd);
    if (status.isDirty) {
      const decision = await prompts.onDirtyWorkingTree();
      if (decision === "cancel") {
        return { status: "cancelled" };
      }
      if (decision === "stash") {
        await this.git.stash(cwd);
      }
      // "force" proceeds without stashing, letting git carry uncommitted
      // changes onto the new branch as it normally would.
    }

    try {
      await this.git.fetch(cwd);
      const baseBranch = await this.git.getDefaultBranch(cwd);
      await this.git.checkoutNewBranch(cwd, branchName, baseBranch);
      return { status: "created", branchName };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : String(error) };
    }
  }
}

import simpleGit from "simple-git";
import type { GitStatusSummary, IGitService } from "../../core/git/git-service.interface";

const DEFAULT_BRANCH_CANDIDATES = ["main", "master", "devel"];

/**
 * {@link IGitService} implemented on top of `simple-git`, which shells
 * out to the real `git` binary. This is a thin adapter over an external
 * process, like the VS Code SecretStorage/webview adapters elsewhere in
 * the codebase (see ADR-0001): not unit tested here, since there is
 * nothing to test but simple-git's own behavior. `BranchManager`, which
 * contains the actual decision logic, is tested against a fake
 * {@link IGitService} instead.
 */
export class SimpleGitService implements IGitService {
  async getRemoteUrl(cwd: string, remoteName = "origin"): Promise<string | null> {
    try {
      const url = await simpleGit(cwd).raw(["remote", "get-url", remoteName]);
      return url.trim() || null;
    } catch {
      return null;
    }
  }

  async getStatus(cwd: string): Promise<GitStatusSummary> {
    const status = await simpleGit(cwd).status();
    return { isDirty: !status.isClean() };
  }

  async fetch(cwd: string, remoteName = "origin"): Promise<void> {
    await simpleGit(cwd).fetch(remoteName);
  }

  async stash(cwd: string, message = "remote-project-manager: auto-stash"): Promise<void> {
    await simpleGit(cwd).stash(["push", "-u", "-m", message]);
  }

  async getDefaultBranch(cwd: string): Promise<string> {
    const git = simpleGit(cwd);
    try {
      const ref = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
      const branch = ref.trim().split("/").pop();
      if (branch) {
        return branch;
      }
    } catch {
      // Fall through to the candidate list below.
    }

    for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
      try {
        await git.raw(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${candidate}`]);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error("Could not determine the default branch (tried main, master, devel).");
  }

  async listBranches(cwd: string, remoteName = "origin"): Promise<string[]> {
    const raw = await simpleGit(cwd).raw(["branch", "-r", "--format=%(refname:short)"]);
    const prefix = `${remoteName}/`;
    const names = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith(prefix) && line !== `${prefix}HEAD`)
      .map((line) => line.slice(prefix.length));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }

  async checkoutNewBranch(cwd: string, branchName: string, baseBranch: string): Promise<void> {
    await simpleGit(cwd).checkoutBranch(branchName, `origin/${baseBranch}`);
  }

  async isValidBranchName(branchName: string): Promise<boolean> {
    try {
      await simpleGit().raw(["check-ref-format", "--branch", branchName]);
      return true;
    } catch {
      return false;
    }
  }
}

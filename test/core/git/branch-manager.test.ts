import { describe, expect, it, vi } from "vitest";
import { BranchManager } from "../../../src/core/git/branch-manager";
import type { IGitService } from "../../../src/core/git/git-service.interface";
import type { IIssue } from "../../../src/core/models/issue.model";

function makeIssue(overrides: Partial<IIssue> = {}): IIssue {
  return {
    id: "acme/widgets#42",
    number: 42,
    title: "Bug: panel does not open",
    body: "",
    state: "open",
    labels: [],
    assignees: [],
    milestoneId: null,
    url: "https://example.com/42",
    provider: "github",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    commentsCount: 0,
    ...overrides,
  };
}

function makeGitService(overrides: Partial<IGitService> = {}): IGitService {
  return {
    getRemoteUrl: vi.fn().mockResolvedValue("git@github.com:acme/widgets.git"),
    getStatus: vi.fn().mockResolvedValue({ isDirty: false }),
    fetch: vi.fn().mockResolvedValue(undefined),
    stash: vi.fn().mockResolvedValue(undefined),
    getDefaultBranch: vi.fn().mockResolvedValue("main"),
    listBranches: vi.fn().mockResolvedValue(["main"]),
    checkoutNewBranch: vi.fn().mockResolvedValue(undefined),
    isValidBranchName: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const CWD = "/ws/widgets";

describe("BranchManager.createBranchForIssue on a clean tree", () => {
  it("fetches, resolves the default branch, and checks out the new branch", async () => {
    const git = makeGitService();
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn(),
    });

    expect(result).toEqual({ status: "created", branchName: "issue/42-bug-panel-does-not-open" });
    expect(git.fetch).toHaveBeenCalledWith(CWD);
    expect(git.getDefaultBranch).toHaveBeenCalledWith(CWD);
    expect(git.checkoutNewBranch).toHaveBeenCalledWith(
      CWD,
      "issue/42-bug-panel-does-not-open",
      "main",
    );
  });

  it("does not prompt the user when the tree is clean", async () => {
    const git = makeGitService();
    const manager = new BranchManager(git);
    const onDirtyWorkingTree = vi.fn();

    await manager.createBranchForIssue(makeIssue(), CWD, { onDirtyWorkingTree });

    expect(onDirtyWorkingTree).not.toHaveBeenCalled();
  });
});

describe("BranchManager.createBranchForIssue on a dirty tree", () => {
  it("cancels without touching git when the user picks 'cancel'", async () => {
    const git = makeGitService({ getStatus: vi.fn().mockResolvedValue({ isDirty: true }) });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn().mockResolvedValue("cancel"),
    });

    expect(result).toEqual({ status: "cancelled" });
    expect(git.fetch).not.toHaveBeenCalled();
    expect(git.checkoutNewBranch).not.toHaveBeenCalled();
  });

  it("stashes before continuing when the user picks 'stash'", async () => {
    const git = makeGitService({ getStatus: vi.fn().mockResolvedValue({ isDirty: true }) });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn().mockResolvedValue("stash"),
    });

    expect(git.stash).toHaveBeenCalledWith(CWD);
    expect(result.status).toBe("created");
  });

  it("skips the stash and proceeds when the user picks 'force'", async () => {
    const git = makeGitService({ getStatus: vi.fn().mockResolvedValue({ isDirty: true }) });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn().mockResolvedValue("force"),
    });

    expect(git.stash).not.toHaveBeenCalled();
    expect(result.status).toBe("created");
  });
});

describe("BranchManager.createBranchForIssue with an explicit base branch", () => {
  it("uses the given base branch and skips resolving the default branch", async () => {
    const git = makeGitService();
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(
      makeIssue(),
      CWD,
      { onDirtyWorkingTree: vi.fn() },
      undefined,
      "develop",
    );

    expect(result).toEqual({ status: "created", branchName: "issue/42-bug-panel-does-not-open" });
    expect(git.getDefaultBranch).not.toHaveBeenCalled();
    expect(git.checkoutNewBranch).toHaveBeenCalledWith(
      CWD,
      "issue/42-bug-panel-does-not-open",
      "develop",
    );
  });
});

describe("BranchManager.createBranchForIssue branch name validation", () => {
  it("reports 'invalid-name' without touching git when the pre-check fails", async () => {
    const git = makeGitService();
    const manager = new BranchManager(git);

    // A custom pattern that produces a space, which looksLikeValidGitRef rejects.
    const result = await manager.createBranchForIssue(
      makeIssue(),
      CWD,
      { onDirtyWorkingTree: vi.fn() },
      "${type} ${issue_id}",
    );

    expect(result.status).toBe("invalid-name");
    expect(git.fetch).not.toHaveBeenCalled();
  });

  it("reports 'invalid-name' when git's own check-ref-format rejects it", async () => {
    const git = makeGitService({ isValidBranchName: vi.fn().mockResolvedValue(false) });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn(),
    });

    expect(result.status).toBe("invalid-name");
    expect(git.fetch).not.toHaveBeenCalled();
  });
});

describe("BranchManager.createBranchForIssue error handling", () => {
  it("reports 'error' when checkoutNewBranch throws", async () => {
    const git = makeGitService({
      checkoutNewBranch: vi.fn().mockRejectedValue(new Error("branch already exists")),
    });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn(),
    });

    expect(result).toEqual({ status: "error", message: "branch already exists" });
  });

  it("reports 'error' (not an unhandled rejection) when stash fails", async () => {
    const git = makeGitService({
      getStatus: vi.fn().mockResolvedValue({ isDirty: true }),
      stash: vi.fn().mockRejectedValue(new Error("stash conflict")),
    });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn().mockResolvedValue("stash"),
    });

    expect(result).toEqual({ status: "error", message: "stash conflict" });
  });

  it("reports 'error' (not an unhandled rejection) when getStatus fails", async () => {
    const git = makeGitService({
      getStatus: vi.fn().mockRejectedValue(new Error("not a git repository")),
    });
    const manager = new BranchManager(git);

    const result = await manager.createBranchForIssue(makeIssue(), CWD, {
      onDirtyWorkingTree: vi.fn(),
    });

    expect(result).toEqual({ status: "error", message: "not a git repository" });
  });
});

import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { Gitlab } from "@gitbeaker/rest";
import { ensureToken, type ICredentialStore } from "./core/auth/ensure-token";
import type { IIssue, ProviderKind } from "./core/models/issue.model";
import type { IProjectProvider } from "./core/providers/project-provider.interface";
import { GithubProvider, type GithubClient } from "./providers/github/github.provider";
import { GitlabProvider, type GitlabClient } from "./providers/gitlab/gitlab.provider";
import { CachingProjectProvider } from "./providers/caching-project-provider";
import { SimpleGitService } from "./providers/git/simple-git.service";
import { resolveRepositoryCandidates, type RepositoryCandidate } from "./core/workspace/repository-resolver";
import { generateBranchName } from "./core/automation/branch-name";
import { shouldAutoCreateBranch } from "./core/automation/auto-branch-guard";
import { BranchManager } from "./core/git/branch-manager";
import type { DirtyTreeDecision } from "./core/git/branch-manager.interface";
import { pickDefaultBaseBranch } from "./core/git/pick-default-base-branch";
import { PanelController } from "./webview/panel-controller";
import type { InboundMessage, RepositoryOptionView } from "./webview/messages";
import { getWebviewHtml } from "./webview/webview-html";

function secretKeyFor(provider: ProviderKind): string {
  return `remoteProjectManager.token.${provider}`;
}

function makeCredentialStore(secrets: vscode.SecretStorage): ICredentialStore {
  return {
    async getToken(provider) {
      return secrets.get(secretKeyFor(provider));
    },
    async setToken(provider, token) {
      await secrets.store(secretKeyFor(provider), token);
    },
  };
}

async function promptForToken(provider: ProviderKind): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: `${provider === "github" ? "GitHub" : "GitLab"} Personal Access Token`,
    prompt: `Enter a ${provider} personal access token with repo/issue read-write scope.`,
    password: true,
    ignoreFocusOut: true,
  });
}

/**
 * Gets a GitHub access token via VS Code's built-in GitHub authentication
 * provider. This never touches our SecretStorage: the session is owned
 * and persisted by VS Code itself. See ADR-0003.
 */
async function getGithubToken(): Promise<string> {
  const session = await vscode.authentication.getSession("github", ["repo"], {
    createIfNone: true,
  });
  return session.accessToken;
}

async function resolveToken(
  providerKind: ProviderKind,
  credentialStore: ICredentialStore,
): Promise<string> {
  if (providerKind === "github") {
    return getGithubToken();
  }
  return ensureToken(credentialStore, providerKind, promptForToken);
}

/**
 * Builds the provider for the configured platform. Octokit's and
 * gitbeaker's real client types are wider than the narrow ports the
 * providers depend on (see ADR-0001); the casts here are the single
 * place that bridges the two, kept out of the testable provider classes.
 */
function buildProvider(providerKind: ProviderKind, repository: string, token: string): IProjectProvider {
  const [owner, repo] = repository.split("/");
  if (providerKind === "github") {
    const octokit = new Octokit({ auth: token });
    return new GithubProvider(octokit.rest as unknown as GithubClient, owner, repo);
  }
  const gitlab = new Gitlab({ token });
  return new GitlabProvider(gitlab as unknown as GitlabClient, repository);
}

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "remoteProjectManager",
    "Remote Project Manager",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview-ui"),
        vscode.Uri.joinPath(context.extensionUri, "media"),
      ],
    },
  );
  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "icon.svg");
  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);
  return panel;
}

/**
 * Resolves which repository to connect to: an explicit
 * `remoteProjectManager.repository` setting wins outright; otherwise
 * every workspace folder's `origin` remote is inspected (see ADR-0003).
 * Returns a single resolved repository, or a list of candidates for the
 * webview picker when more than one workspace folder matches.
 */
async function resolveRepository(): Promise<
  | { kind: "resolved"; providerKind: ProviderKind; repository: string; folderPath?: string }
  | { kind: "candidates"; candidates: RepositoryCandidate[] }
  | { kind: "none" }
> {
  const config = vscode.workspace.getConfiguration("remoteProjectManager");
  const providerKindSetting = config.get<ProviderKind>("provider", "github");
  const repositorySetting = config.get<string>("repository", "");

  if (repositorySetting.includes("/")) {
    return {
      kind: "resolved",
      providerKind: providerKindSetting,
      repository: repositorySetting,
      folderPath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    };
  }

  const gitService = new SimpleGitService();
  const folders = vscode.workspace.workspaceFolders ?? [];
  const remotes = await Promise.all(
    folders.map(async (folder) => ({
      folderPath: folder.uri.fsPath,
      folderName: folder.name,
      remoteUrl: await gitService.getRemoteUrl(folder.uri.fsPath),
    })),
  );
  const candidates = resolveRepositoryCandidates(remotes);

  if (candidates.length === 0) {
    return { kind: "none" };
  }
  if (candidates.length === 1) {
    return {
      kind: "resolved",
      providerKind: candidates[0].provider,
      repository: candidates[0].repository,
      folderPath: candidates[0].folderPath,
    };
  }
  return { kind: "candidates", candidates };
}

function toRepositoryOptionView(candidate: RepositoryCandidate): RepositoryOptionView {
  return {
    id: candidate.folderPath,
    label: `${candidate.folderName} — ${candidate.provider}:${candidate.repository}`,
    provider: candidate.provider,
    repository: candidate.repository,
  };
}

/** Asks the user how to proceed given a dirty working tree, via a modal. */
async function promptDirtyWorkingTree(issueNumber: number): Promise<DirtyTreeDecision> {
  const stashChoice = "Stash & Continue";
  const forceChoice = "Force Switch";
  const cancelChoice = "Cancel";
  const choice = await vscode.window.showWarningMessage(
    `Your working tree has uncommitted changes. Creating a branch for issue #${issueNumber} will switch branches.`,
    { modal: true },
    stashChoice,
    forceChoice,
    cancelChoice,
  );
  if (choice === stashChoice) {
    return "stash";
  }
  if (choice === forceChoice) {
    return "force";
  }
  return "cancel";
}

/**
 * Reports a BranchManager outcome to the user. "cancelled" is
 * deliberately silent: the user just declined via the dirty-tree prompt.
 */
function reportBranchCreationOutcome(
  result: Awaited<ReturnType<BranchManager["createBranchForIssue"]>>,
): void {
  switch (result.status) {
    case "created":
      void vscode.window.showInformationMessage(`Switched to new branch '${result.branchName}'.`);
      break;
    case "invalid-name":
      void vscode.window.showErrorMessage(
        `Generated branch name '${result.branchName}' is not a valid git ref. Check 'remoteProjectManager.branchNamePattern'.`,
      );
      break;
    case "error":
      void vscode.window.showErrorMessage(`Could not create branch: ${result.message}`);
      break;
    case "cancelled":
      break;
  }
}

/**
 * Lets the user search-select which branch to base the new branch on, via
 * a quick pick pre-filtered to `origin`'s branches. `main`/`master` (main
 * winning when both exist) is placed first so it starts focused/selected.
 * Returns `undefined` if the user backs out.
 */
async function pickBaseBranch(gitService: SimpleGitService, cwd: string): Promise<string | undefined> {
  const branches = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Fetching branches from origin…" },
    async () => {
      await gitService.fetch(cwd);
      return gitService.listBranches(cwd);
    },
  );
  if (branches.length === 0) {
    throw new Error("No branches found on 'origin'.");
  }

  const defaultBranch = pickDefaultBaseBranch(branches);
  const ordered = defaultBranch ? [defaultBranch, ...branches.filter((branch) => branch !== defaultBranch)] : branches;

  return vscode.window.showQuickPick(ordered, {
    title: "Base branch",
    placeHolder: "Branch to create the new branch from",
  });
}

/**
 * Handles a manual "create branch" request from the issue detail panel:
 * search-select the base branch, then create and switch via
 * {@link BranchManager}. Returns a toast message on success, or `null`
 * when the user cancelled at any step (base-branch picker or the
 * dirty-tree prompt); throws on failure so `PanelController` reports it.
 */
async function requestCreateBranch(
  issue: IIssue,
  cwd: string,
  gitService: SimpleGitService,
  branchManager: BranchManager,
  pattern: string | undefined,
): Promise<string | null> {
  const baseBranch = await pickBaseBranch(gitService, cwd);
  if (!baseBranch) {
    return null;
  }

  const result = await branchManager.createBranchForIssue(
    issue,
    cwd,
    { onDirtyWorkingTree: () => promptDirtyWorkingTree(issue.number) },
    pattern,
    baseBranch,
  );

  switch (result.status) {
    case "created":
      return `Switched to new branch '${result.branchName}'.`;
    case "cancelled":
      return null;
    case "invalid-name":
      throw new Error(
        `Generated branch name '${result.branchName}' is not a valid git ref. Check 'remoteProjectManager.branchNamePattern'.`,
      );
    case "error":
      throw new Error(`Could not create branch: ${result.message}`);
  }
}

/** Builds a fully wired PanelController for a resolved provider/repository. */
async function buildController(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  providerKind: ProviderKind,
  repository: string,
  folderPath: string | undefined,
): Promise<PanelController> {
  const credentialStore = makeCredentialStore(context.secrets);
  const token = await resolveToken(providerKind, credentialStore);

  const config = vscode.workspace.getConfiguration("remoteProjectManager");
  const cacheTtlSeconds = config.get<number>("cacheTtlSeconds", 180);
  const provider = new CachingProjectProvider(buildProvider(providerKind, repository, token), cacheTtlSeconds * 1000);

  const autoBranchEnabled = config.get<boolean>("autoBranchOnInProgress", true);
  const branchNamePattern = config.get<string>("branchNamePattern", "");
  const pattern = branchNamePattern || undefined;
  const gitService = new SimpleGitService();
  const branchManager = new BranchManager(gitService);
  const currentUser = await provider.getCurrentUser();

  return new PanelController(
    provider,
    (message) => {
      void panel.webview.postMessage(message);
    },
    (issue, transition) => {
      if (!shouldAutoCreateBranch(issue, transition, currentUser.username)) {
        return;
      }

      if (!autoBranchEnabled || !folderPath) {
        void vscode.window.showInformationMessage(
          `Issue #${issue.number} moved to in-progress. Suggested branch: ${generateBranchName(issue, pattern)}`,
        );
        return;
      }

      void branchManager
        .createBranchForIssue(issue, folderPath, { onDirtyWorkingTree: () => promptDirtyWorkingTree(issue.number) }, pattern)
        .then(reportBranchCreationOutcome);
    },
    (issue) => {
      if (!folderPath) {
        throw new Error("No workspace folder resolved for this repository; cannot create a branch.");
      }
      return requestCreateBranch(issue, folderPath, gitService, branchManager, pattern);
    },
  );
}

async function openPanel(context: vscode.ExtensionContext): Promise<void> {
  const resolution = await resolveRepository();

  if (resolution.kind === "none") {
    void vscode.window.showErrorMessage(
      "No GitHub/GitLab repository detected in this workspace. Set 'remoteProjectManager.repository' to 'owner/repo' manually.",
    );
    return;
  }

  const panel = createPanel(context);

  if (resolution.kind === "resolved") {
    let controller: PanelController;
    try {
      controller = await buildController(context, panel, resolution.providerKind, resolution.repository, resolution.folderPath);
    } catch (error) {
      void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    panel.webview.onDidReceiveMessage((message: InboundMessage) => {
      void controller.handleMessage(message);
    });
    void controller.handleMessage({ type: "requestState" });
    return;
  }

  // Multiple candidates: let the webview's picker choose before building
  // any provider, so no token is requested until a repository is picked.
  const candidates = resolution.candidates;
  let controller: PanelController | undefined;

  panel.webview.onDidReceiveMessage(async (message: InboundMessage) => {
    if (controller) {
      void controller.handleMessage(message);
      return;
    }

    if (message.type === "requestState") {
      void panel.webview.postMessage({
        type: "repositoryOptions",
        options: candidates.map(toRepositoryOptionView),
      });
      return;
    }

    if (message.type === "selectRepository") {
      const chosen = candidates.find((candidate) => candidate.folderPath === message.id);
      if (!chosen) {
        return;
      }
      try {
        controller = await buildController(context, panel, chosen.provider, chosen.repository, chosen.folderPath);
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        return;
      }
      void controller.handleMessage({ type: "requestState" });
    }
  });
}

/**
 * Empty tree so the sidebar view has no content of its own and always
 * falls back to the `viewsWelcome` entry, whose "Open Panel" link runs
 * the `remoteProjectManager.openPanel` command.
 */
class EmptyTreeDataProvider implements vscode.TreeDataProvider<never> {
  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }
  getChildren(): never[] {
    return [];
  }
}

/**
 * Clears the stored GitLab Personal Access Token from `SecretStorage`.
 * There is no way to detect a revoked/expired token proactively, so this
 * is the escape hatch for switching accounts or recovering from a stale
 * token: the next GitLab connection prompts for a fresh one.
 */
async function signOutGitLab(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(secretKeyFor("gitlab"));
  void vscode.window.showInformationMessage(
    "Signed out of GitLab. You'll be prompted for a new token next time the panel connects to a GitLab repository.",
  );
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("remoteProjectManager.openPanel", () => {
      void openPanel(context);
    }),
    vscode.commands.registerCommand("remoteProjectManager.signOutGitLab", () => {
      void signOutGitLab(context);
    }),
    vscode.window.registerTreeDataProvider("remoteProjectManager.sidebar", new EmptyTreeDataProvider()),
  );
}

export function deactivate(): void {
  // No cleanup required: webview panels and subscriptions are disposed
  // by VS Code when the extension host shuts down.
}

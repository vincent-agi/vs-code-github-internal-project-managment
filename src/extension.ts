import * as vscode from "vscode";
import { Octokit } from "@octokit/rest";
import { Gitlab } from "@gitbeaker/rest";
import { ensureToken, type ICredentialStore } from "./core/auth/ensure-token";
import type { ProviderKind } from "./core/models/issue.model";
import type { IProjectProvider } from "./core/providers/project-provider.interface";
import { GithubProvider, type GithubClient } from "./providers/github/github.provider";
import { GitlabProvider, type GitlabClient } from "./providers/gitlab/gitlab.provider";
import { generateBranchName } from "./core/automation/branch-name";
import { PanelController } from "./webview/panel-controller";
import type { InboundMessage } from "./webview/messages";
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

async function openPanel(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("remoteProjectManager");
  const providerKind = config.get<ProviderKind>("provider", "github");
  const repository = config.get<string>("repository", "");

  if (!repository.includes("/")) {
    void vscode.window.showErrorMessage(
      "Set 'remoteProjectManager.repository' to 'owner/repo' (or 'namespace/project' for GitLab) before opening the panel.",
    );
    return;
  }

  const credentialStore = makeCredentialStore(context.secrets);
  let token: string;
  try {
    token = await ensureToken(credentialStore, providerKind, promptForToken);
  } catch (error) {
    void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    return;
  }

  const provider = buildProvider(providerKind, repository, token);

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

  const controller = new PanelController(
    provider,
    (message) => {
      void panel.webview.postMessage(message);
    },
    (issue, transition) => {
      if (transition === "started-in-progress") {
        void vscode.window.showInformationMessage(
          `Issue #${issue.number} moved to in-progress. Suggested branch: ${generateBranchName(issue)}`,
        );
      }
    },
  );

  panel.webview.onDidReceiveMessage((message: InboundMessage) => {
    void controller.handleMessage(message);
  });
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("remoteProjectManager.openPanel", () => {
      void openPanel(context);
    }),
  );
}

export function deactivate(): void {
  // No cleanup required: webview panels and subscriptions are disposed
  // by VS Code when the extension host shuts down.
}

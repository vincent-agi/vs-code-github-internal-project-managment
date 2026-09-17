import type { ProviderKind } from "../models/issue.model";

/**
 * Persists and retrieves provider access tokens. Implemented in the
 * extension host with `vscode.SecretStorage`; kept as an interface here
 * so this logic can run outside VS Code in tests.
 */
export interface ICredentialStore {
  getToken(provider: ProviderKind): Promise<string | undefined>;
  setToken(provider: ProviderKind, token: string): Promise<void>;
}

/** Asks the user for a token; resolves to undefined if they cancel. */
export type TokenPrompt = (provider: ProviderKind) => Promise<string | undefined>;

/**
 * Returns the stored token for a provider, prompting the user for one and
 * persisting it if none is stored yet.
 *
 * @throws {Error} If the user cancels the prompt.
 */
export async function ensureToken(
  store: ICredentialStore,
  provider: ProviderKind,
  promptForToken: TokenPrompt,
): Promise<string> {
  const existing = await store.getToken(provider);
  if (existing) {
    return existing;
  }

  const entered = await promptForToken(provider);
  if (!entered) {
    throw new Error(`A personal access token is required to connect to ${provider}.`);
  }

  await store.setToken(provider, entered);
  return entered;
}

import { describe, expect, it, vi } from "vitest";
import { ensureToken, type ICredentialStore } from "../../../src/core/auth/ensure-token";

function makeStore(initialToken: string | undefined): ICredentialStore {
  let stored = initialToken;
  return {
    getToken: vi.fn(async () => stored),
    setToken: vi.fn(async (_provider: string, token: string) => {
      stored = token;
    }),
  };
}

describe("ensureToken", () => {
  it("returns the stored token without prompting when one exists", async () => {
    const store = makeStore("stored-token");
    const promptForToken = vi.fn();

    const token = await ensureToken(store, "github", promptForToken);

    expect(token).toBe("stored-token");
    expect(promptForToken).not.toHaveBeenCalled();
  });

  it("prompts and persists the token when none is stored", async () => {
    const store = makeStore(undefined);
    const promptForToken = vi.fn().mockResolvedValue("new-token");

    const token = await ensureToken(store, "github", promptForToken);

    expect(token).toBe("new-token");
    expect(store.setToken).toHaveBeenCalledWith("github", "new-token");
  });

  it("throws if the user cancels the prompt", async () => {
    const store = makeStore(undefined);
    const promptForToken = vi.fn().mockResolvedValue(undefined);

    await expect(ensureToken(store, "github", promptForToken)).rejects.toThrow(/token/i);
  });
});

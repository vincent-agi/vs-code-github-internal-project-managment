import { describe, expect, it } from "vitest";
import { buildCommitMessage, validateCommitMessage } from "../../../src/core/git/commit-message";

describe("buildCommitMessage", () => {
  it("composes type, scope, gitmoji, and description", () => {
    expect(
      buildCommitMessage({
        type: "feat",
        scope: "commits",
        gitmoji: "✨",
        description: "add gitmoji picker",
      }),
    ).toBe("feat(commits): ✨ add gitmoji picker");
  });

  it("drops the scope group entirely when scope is absent", () => {
    expect(
      buildCommitMessage({ type: "fix", gitmoji: "🐛", description: "handle empty state" }),
    ).toBe("fix: 🐛 handle empty state");
  });

  it("appends a Fixes trailer on its own line when requested", () => {
    expect(
      buildCommitMessage({
        type: "fix",
        gitmoji: "🐛",
        description: "escape date fallback",
        issueNumber: 53,
        issueReferenceKind: "fixes",
      }),
    ).toBe("fix: 🐛 escape date fallback\n\nFixes #53");
  });

  it("appends a Refs trailer instead of Fixes when requested", () => {
    expect(
      buildCommitMessage({
        type: "feat",
        gitmoji: "✨",
        description: "wip",
        issueNumber: 10,
        issueReferenceKind: "refs",
      }),
    ).toBe("feat: ✨ wip\n\nRefs #10");
  });

  it("omits the trailer when issueReferenceKind is 'none'", () => {
    expect(
      buildCommitMessage({
        type: "chore",
        gitmoji: "🔧",
        description: "tidy config",
        issueNumber: 10,
        issueReferenceKind: "none",
      }),
    ).toBe("chore: 🔧 tidy config");
  });

  it("omits the trailer when no issue number is given, regardless of kind", () => {
    expect(
      buildCommitMessage({
        type: "chore",
        gitmoji: "🔧",
        description: "tidy config",
        issueReferenceKind: "fixes",
      }),
    ).toBe("chore: 🔧 tidy config");
  });
});

describe("validateCommitMessage", () => {
  it("accepts a well-formed message with emoji gitmoji", () => {
    expect(validateCommitMessage("feat(ui): ✨ add gitmoji picker").valid).toBe(true);
  });

  it("accepts a well-formed message with :code: gitmoji", () => {
    expect(validateCommitMessage("fix: :bug: escape fallback").valid).toBe(true);
  });

  it("accepts a message with no scope", () => {
    expect(validateCommitMessage("docs: 📝 update README").valid).toBe(true);
  });

  it("accepts a multi-line message, checking only the subject", () => {
    expect(validateCommitMessage("fix: 🐛 escape fallback\n\nFixes #53").valid).toBe(true);
  });

  it("accepts a gitmoji with a trailing variation selector (e.g. :lock:'s 🔒️)", () => {
    expect(validateCommitMessage("fix: 🔒️ patch auth hole").valid).toBe(true);
  });

  it("accepts a ZWJ-sequence gitmoji (e.g. :technologist:'s 🧑‍💻)", () => {
    expect(validateCommitMessage("feat: 🧑‍💻 improve DX").valid).toBe(true);
  });

  it("accepts every gitmoji bundled in resources/gitmojis.json", async () => {
    const gitmojis = (await import("../../../resources/gitmojis.json")).default;
    for (const gitmoji of gitmojis) {
      const result = validateCommitMessage(`fix: ${gitmoji.emoji} some description`);
      expect(result.valid, `${gitmoji.code} (${gitmoji.emoji}) should validate`).toBe(true);
    }
  });

  it("rejects a message missing the gitmoji", () => {
    const result = validateCommitMessage("fix: escape fallback");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("rejects a message missing the colon separator", () => {
    expect(validateCommitMessage("fix 🐛 escape fallback").valid).toBe(false);
  });

  it("rejects an empty message", () => {
    expect(validateCommitMessage("").valid).toBe(false);
  });

  it("rejects an uppercase type token", () => {
    expect(validateCommitMessage("Fix: 🐛 escape fallback").valid).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { findGitmojiByCode, parseGitmojis } from "../../../src/core/git/gitmoji";
import gitmojis from "../../../resources/gitmojis.json";

describe("parseGitmojis", () => {
  it("accepts the bundled resources/gitmojis.json as-is", () => {
    const parsed = parseGitmojis(gitmojis);
    expect(parsed.length).toBeGreaterThan(10);
    expect(parsed[0]).toHaveProperty("emoji");
    expect(parsed[0]).toHaveProperty("code");
    expect(parsed[0]).toHaveProperty("description");
  });

  it("rejects a non-array payload", () => {
    expect(() => parseGitmojis({ not: "an array" })).toThrow();
  });

  it("rejects an array with no well-formed entries", () => {
    expect(() => parseGitmojis([{ emoji: "✨" }, 42, "nope"])).toThrow();
  });

  it("filters out malformed entries but keeps well-formed ones", () => {
    const parsed = parseGitmojis([
      { emoji: "✨", code: ":sparkles:", description: "New feature." },
      { emoji: "🐛" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].code).toBe(":sparkles:");
  });
});

describe("findGitmojiByCode", () => {
  it("finds an entry by exact code", () => {
    const list = parseGitmojis(gitmojis);
    expect(findGitmojiByCode(list, ":bug:")?.emoji).toBe("🐛");
  });

  it("returns undefined for an unknown code", () => {
    const list = parseGitmojis(gitmojis);
    expect(findGitmojiByCode(list, ":does-not-exist:")).toBeUndefined();
  });
});

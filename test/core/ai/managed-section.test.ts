import { describe, expect, it } from "vitest";
import { replaceManagedSection } from "../../../src/core/ai/managed-section";

describe("replaceManagedSection", () => {
  it("appends the managed section to an empty file", () => {
    const result = replaceManagedSection("", "milestone-context", "Hello");
    expect(result).toBe(
      "<!-- remote-project-manager:milestone-context:start -->\nHello\n<!-- remote-project-manager:milestone-context:end -->\n",
    );
  });

  it("appends the managed section after existing hand-written content", () => {
    const result = replaceManagedSection("# My notes\nSome text.", "milestone-context", "Hello");
    expect(
      result.startsWith(
        "# My notes\nSome text.\n\n<!-- remote-project-manager:milestone-context:start -->",
      ),
    ).toBe(true);
  });

  it("replaces only the content between existing markers, leaving the rest untouched", () => {
    const existing = [
      "# My notes",
      "Before.",
      "<!-- remote-project-manager:milestone-context:start -->",
      "Old content",
      "<!-- remote-project-manager:milestone-context:end -->",
      "After.",
    ].join("\n");

    const result = replaceManagedSection(existing, "milestone-context", "New content");

    expect(result).toContain("# My notes\nBefore.");
    expect(result).toContain("New content");
    expect(result).not.toContain("Old content");
    expect(result).toContain("After.");
  });

  it("is idempotent when run twice with the same block", () => {
    const once = replaceManagedSection("# Notes", "ctx", "Block A");
    const twice = replaceManagedSection(once, "ctx", "Block A");
    expect(twice).toBe(once);
  });

  it("does not touch a differently-named managed section", () => {
    const existing = replaceManagedSection("", "other-section", "Other content");
    const result = replaceManagedSection(existing, "milestone-context", "New content");
    expect(result).toContain("Other content");
    expect(result).toContain("New content");
  });
});

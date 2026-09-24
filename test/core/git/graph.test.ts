import { describe, expect, it } from "vitest";
import { groupCommitsByIssue } from "../../../src/core/git/graph";

describe("groupCommitsByIssue", () => {
  it("groups commits by referenced issue number, descending", () => {
    const groups = groupCommitsByIssue([
      { hash: "a", message: "fix: 🐛 a\n\nFixes #53" },
      { hash: "b", message: "feat: ✨ b (#55)" },
      { hash: "c", message: "chore: 🔧 c\n\nRefs #53" },
    ]);
    expect(groups.map((group) => group.issueNumber)).toEqual([55, 53]);
    expect(groups.find((group) => group.issueNumber === 53)?.commits.map((c) => c.hash)).toEqual([
      "a",
      "c",
    ]);
  });

  it("collects unreferenced commits into a trailing null (Unlinked) group", () => {
    const groups = groupCommitsByIssue([
      { hash: "a", message: "feat: ✨ a (#1)" },
      { hash: "b", message: "chore: 🔧 tidy" },
    ]);
    expect(groups.at(-1)).toEqual({
      issueNumber: null,
      commits: [{ hash: "b", message: "chore: 🔧 tidy" }],
    });
  });

  it("returns an empty array for no commits", () => {
    expect(groupCommitsByIssue([])).toEqual([]);
  });

  it("omits the Unlinked group when every commit is referenced", () => {
    const groups = groupCommitsByIssue([{ hash: "a", message: "feat: ✨ a (#1)" }]);
    expect(groups.some((group) => group.issueNumber === null)).toBe(false);
  });
});

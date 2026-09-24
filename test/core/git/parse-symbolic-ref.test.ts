import { describe, expect, it } from "vitest";
import { parseSymbolicRefBranch } from "../../../src/core/git/parse-symbolic-ref";

describe("parseSymbolicRefBranch", () => {
  it("extracts a simple branch name", () => {
    expect(parseSymbolicRefBranch("refs/remotes/origin/main\n")).toBe("main");
  });

  it("does not truncate a branch name that itself contains a '/'", () => {
    expect(parseSymbolicRefBranch("refs/remotes/origin/release/2.0\n")).toBe("release/2.0");
  });

  it("returns undefined for output without the expected prefix", () => {
    expect(parseSymbolicRefBranch("something unexpected")).toBeUndefined();
  });

  it("trims surrounding whitespace before matching the prefix", () => {
    expect(parseSymbolicRefBranch("  refs/remotes/origin/main  \n")).toBe("main");
  });
});

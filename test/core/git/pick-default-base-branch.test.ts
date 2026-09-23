import { describe, expect, it } from "vitest";
import { pickDefaultBaseBranch } from "../../../src/core/git/pick-default-base-branch";

describe("pickDefaultBaseBranch", () => {
  it("prefers 'main' when both 'main' and 'master' exist", () => {
    expect(pickDefaultBaseBranch(["master", "main", "develop"])).toBe("main");
  });

  it("falls back to 'master' when 'main' does not exist", () => {
    expect(pickDefaultBaseBranch(["develop", "master"])).toBe("master");
  });

  it("returns undefined when neither exists", () => {
    expect(pickDefaultBaseBranch(["develop", "staging"])).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    expect(pickDefaultBaseBranch([])).toBeUndefined();
  });
});

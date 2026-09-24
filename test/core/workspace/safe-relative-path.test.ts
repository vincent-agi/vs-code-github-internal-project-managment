import { describe, expect, it } from "vitest";
import { resolveSafeRelativeSegments } from "../../../src/core/workspace/safe-relative-path";

describe("resolveSafeRelativeSegments", () => {
  it("returns the segments for a plain relative path", () => {
    expect(resolveSafeRelativeSegments(".github/copilot-instructions.md")).toEqual([
      ".github",
      "copilot-instructions.md",
    ]);
  });

  it("accepts backslash-separated (Windows-style) paths", () => {
    expect(resolveSafeRelativeSegments(".claudecode\\context.md")).toEqual([
      ".claudecode",
      "context.md",
    ]);
  });

  it("drops '.' segments", () => {
    expect(resolveSafeRelativeSegments("./docs/./context.md")).toEqual(["docs", "context.md"]);
  });

  it("rejects a path that escapes the root", () => {
    expect(resolveSafeRelativeSegments("../../../.ssh/authorized_keys")).toBeNull();
  });

  it("rejects a bare leading '..'", () => {
    expect(resolveSafeRelativeSegments("../secret.md")).toBeNull();
  });

  it("accepts a path whose '..' is compensated by an earlier segment, staying inside the root", () => {
    expect(resolveSafeRelativeSegments("sub/../context.md")).toEqual(["context.md"]);
  });

  it("rejects a path whose '..' net-escapes despite an earlier segment", () => {
    expect(resolveSafeRelativeSegments("sub/../../secret.md")).toBeNull();
  });
});

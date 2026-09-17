import { describe, expect, it } from "vitest";
import {
  parseGitRemoteUrl,
  resolveRepositoryCandidates,
} from "../../../src/core/workspace/repository-resolver";

describe("parseGitRemoteUrl", () => {
  it("parses a GitHub SSH (scp-like) URL", () => {
    expect(parseGitRemoteUrl("git@github.com:acme/widgets.git")).toEqual({
      provider: "github",
      repository: "acme/widgets",
    });
  });

  it("parses a GitHub HTTPS URL with .git suffix", () => {
    expect(parseGitRemoteUrl("https://github.com/acme/widgets.git")).toEqual({
      provider: "github",
      repository: "acme/widgets",
    });
  });

  it("parses a GitHub HTTPS URL without .git suffix", () => {
    expect(parseGitRemoteUrl("https://github.com/acme/widgets")).toEqual({
      provider: "github",
      repository: "acme/widgets",
    });
  });

  it("parses a GitHub HTTPS URL with embedded credentials", () => {
    expect(parseGitRemoteUrl("https://user:token@github.com/acme/widgets.git")).toEqual({
      provider: "github",
      repository: "acme/widgets",
    });
  });

  it("parses a GitLab SSH URL", () => {
    expect(parseGitRemoteUrl("git@gitlab.com:acme/widgets.git")).toEqual({
      provider: "gitlab",
      repository: "acme/widgets",
    });
  });

  it("parses a GitLab HTTPS URL", () => {
    expect(parseGitRemoteUrl("https://gitlab.com/acme/widgets.git")).toEqual({
      provider: "gitlab",
      repository: "acme/widgets",
    });
  });

  it("parses an explicit ssh:// GitHub URL", () => {
    expect(parseGitRemoteUrl("ssh://git@github.com/acme/widgets.git")).toEqual({
      provider: "github",
      repository: "acme/widgets",
    });
  });

  it("returns null for an unsupported host", () => {
    expect(parseGitRemoteUrl("https://bitbucket.org/acme/widgets.git")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(parseGitRemoteUrl("not a url")).toBeNull();
  });

  it("returns null when the path has fewer than owner+repo segments", () => {
    expect(parseGitRemoteUrl("https://github.com/acme")).toBeNull();
  });
});

describe("resolveRepositoryCandidates", () => {
  it("maps folders with a parseable remote into candidates", () => {
    const candidates = resolveRepositoryCandidates([
      { folderPath: "/ws/api", folderName: "api", remoteUrl: "git@github.com:acme/api.git" },
      { folderPath: "/ws/web", folderName: "web", remoteUrl: "git@gitlab.com:acme/web.git" },
    ]);

    expect(candidates).toEqual([
      { folderPath: "/ws/api", folderName: "api", provider: "github", repository: "acme/api" },
      { folderPath: "/ws/web", folderName: "web", provider: "gitlab", repository: "acme/web" },
    ]);
  });

  it("skips folders with no remote or an unparseable remote", () => {
    const candidates = resolveRepositoryCandidates([
      { folderPath: "/ws/api", folderName: "api", remoteUrl: "git@github.com:acme/api.git" },
      { folderPath: "/ws/no-remote", folderName: "no-remote", remoteUrl: null },
      { folderPath: "/ws/other", folderName: "other", remoteUrl: "https://bitbucket.org/acme/x.git" },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].folderName).toBe("api");
  });
});

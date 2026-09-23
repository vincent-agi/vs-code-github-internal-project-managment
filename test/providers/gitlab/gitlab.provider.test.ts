import { describe, expect, it, vi } from "vitest";
import { GitlabProvider, type GitlabClient } from "../../../src/providers/gitlab/gitlab.provider";

function makeClient(overrides: Partial<GitlabClient> = {}): GitlabClient {
  return {
    Issues: {
      all: vi.fn().mockResolvedValue([]),
      show: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
    },
    ProjectMilestones: {
      all: vi.fn().mockResolvedValue([]),
      show: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
    },
    Projects: {
      show: vi.fn(),
    },
    Users: {
      showCurrentUser: vi.fn(),
    },
    ...overrides,
  } as unknown as GitlabClient;
}

const rawIssue = {
  iid: 42,
  title: "Bug",
  description: "desc",
  state: "opened" as const,
  labels: [],
  assignees: [],
  milestone: null,
  web_url: "https://gitlab.com/acme/widgets/-/issues/42",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const rawMilestone = {
  id: 7,
  iid: 3,
  title: "v1.0",
  description: "",
  state: "active" as const,
  due_date: null,
  web_url: "https://gitlab.com/acme/widgets/-/milestones/3",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("GitlabProvider.listIssues", () => {
  it("maps issues from the project", async () => {
    const client = makeClient({
      Issues: { all: vi.fn().mockResolvedValue([rawIssue]) } as unknown as GitlabClient["Issues"],
    });
    const provider = new GitlabProvider(client, "acme/widgets");

    const issues = await provider.listIssues();

    expect(issues).toHaveLength(1);
    expect(issues[0].number).toBe(42);
  });
});

describe("GitlabProvider.getIssue", () => {
  it("fetches by the iid embedded in the composite id", async () => {
    const show = vi.fn().mockResolvedValue(rawIssue);
    const client = makeClient({ Issues: { show } as unknown as GitlabClient["Issues"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const issue = await provider.getIssue("acme/widgets#42");

    expect(show).toHaveBeenCalledWith("acme/widgets", 42);
    expect(issue.id).toBe("acme/widgets#42");
  });
});

describe("GitlabProvider.createIssue", () => {
  it("sends title and description and maps the response", async () => {
    const create = vi.fn().mockResolvedValue(rawIssue);
    const client = makeClient({ Issues: { create } as unknown as GitlabClient["Issues"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const issue = await provider.createIssue({ title: "Bug", body: "desc" });

    expect(create).toHaveBeenCalledWith(
      "acme/widgets",
      expect.objectContaining({ title: "Bug", description: "desc" }),
    );
    expect(issue.number).toBe(42);
  });
});

describe("GitlabProvider.updateIssue", () => {
  it("maps the domain state to GitLab's 'opened'/'closed' vocabulary", async () => {
    const edit = vi.fn().mockResolvedValue({ ...rawIssue, state: "closed" });
    const client = makeClient({ Issues: { edit } as unknown as GitlabClient["Issues"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const issue = await provider.updateIssue("acme/widgets#42", { state: "closed" });

    expect(edit).toHaveBeenCalledWith(
      "acme/widgets",
      42,
      expect.objectContaining({ state_event: "close" }),
    );
    expect(issue.state).toBe("closed");
  });

  it("uses 'reopen' state_event to move an issue back to open", async () => {
    const edit = vi.fn().mockResolvedValue(rawIssue);
    const client = makeClient({ Issues: { edit } as unknown as GitlabClient["Issues"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    await provider.updateIssue("acme/widgets#42", { state: "open" });

    expect(edit).toHaveBeenCalledWith(
      "acme/widgets",
      42,
      expect.objectContaining({ state_event: "reopen" }),
    );
  });
});

describe("GitlabProvider.listMilestones", () => {
  it("maps milestones", async () => {
    const client = makeClient({
      ProjectMilestones: { all: vi.fn().mockResolvedValue([rawMilestone]) } as unknown as GitlabClient["ProjectMilestones"],
    });
    const provider = new GitlabProvider(client, "acme/widgets");

    const milestones = await provider.listMilestones();

    expect(milestones).toEqual([
      {
        id: "7",
        number: 3,
        title: "v1.0",
        description: "",
        state: "open",
        dueOn: null,
        url: "https://gitlab.com/acme/widgets/-/milestones/3",
        provider: "gitlab",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });
});

describe("GitlabProvider.getMilestone", () => {
  it("fetches directly by the domain id (GitLab's milestone_id)", async () => {
    const show = vi.fn().mockResolvedValue(rawMilestone);
    const client = makeClient({ ProjectMilestones: { show } as unknown as GitlabClient["ProjectMilestones"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const milestone = await provider.getMilestone("7");

    expect(show).toHaveBeenCalledWith("acme/widgets", 7);
    expect(milestone.title).toBe("v1.0");
  });
});

describe("GitlabProvider.createMilestone", () => {
  it("sends title and maps the response", async () => {
    const create = vi.fn().mockResolvedValue(rawMilestone);
    const client = makeClient({ ProjectMilestones: { create } as unknown as GitlabClient["ProjectMilestones"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const milestone = await provider.createMilestone({ title: "v1.0" });

    expect(create).toHaveBeenCalledWith("acme/widgets", expect.objectContaining({ title: "v1.0" }));
    expect(milestone.id).toBe("7");
  });
});

describe("GitlabProvider.updateMilestone", () => {
  it("edits directly by the domain id", async () => {
    const edit = vi.fn().mockResolvedValue({ ...rawMilestone, state: "closed" });
    const client = makeClient({ ProjectMilestones: { edit } as unknown as GitlabClient["ProjectMilestones"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const milestone = await provider.updateMilestone("7", { state: "closed" });

    expect(edit).toHaveBeenCalledWith(
      "acme/widgets",
      7,
      expect.objectContaining({ state_event: "close" }),
    );
    expect(milestone.state).toBe("closed");
  });
});

describe("GitlabProvider.getCurrentUser", () => {
  it("returns the current user's username", async () => {
    const showCurrentUser = vi.fn().mockResolvedValue({ username: "octocat" });
    const client = makeClient({ Users: { showCurrentUser } as unknown as GitlabClient["Users"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const user = await provider.getCurrentUser();

    expect(user).toEqual({ username: "octocat" });
  });
});

describe("GitlabProvider.getCapabilities", () => {
  it("maps Developer access (30) and above to write capability", async () => {
    const show = vi.fn().mockResolvedValue({ permissions: { project_access: { access_level: 30 } } });
    const client = makeClient({ Projects: { show } as unknown as GitlabClient["Projects"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const capabilities = await provider.getCapabilities();

    expect(capabilities).toEqual({
      canReadIssues: true,
      canWriteIssues: true,
      canReadMilestones: true,
      canWriteMilestones: true,
    });
  });

  it("maps Reporter access (20) to read-only", async () => {
    const show = vi.fn().mockResolvedValue({ permissions: { project_access: { access_level: 20 } } });
    const client = makeClient({ Projects: { show } as unknown as GitlabClient["Projects"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const capabilities = await provider.getCapabilities();

    expect(capabilities.canWriteIssues).toBe(false);
    expect(capabilities.canWriteMilestones).toBe(false);
  });

  it("falls back to group_access when project_access is absent", async () => {
    const show = vi.fn().mockResolvedValue({ permissions: { group_access: { access_level: 40 } } });
    const client = makeClient({ Projects: { show } as unknown as GitlabClient["Projects"] });
    const provider = new GitlabProvider(client, "acme/widgets");

    const capabilities = await provider.getCapabilities();

    expect(capabilities.canWriteIssues).toBe(true);
  });
});

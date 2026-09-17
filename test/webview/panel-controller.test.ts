import { describe, expect, it, vi } from "vitest";
import { PanelController } from "../../src/webview/panel-controller";
import type { IProjectProvider, ProviderCapabilities } from "../../src/core/providers/project-provider.interface";
import type { IIssue } from "../../src/core/models/issue.model";
import type { IMilestone } from "../../src/core/models/milestone.model";

const issue: IIssue = {
  id: "acme/widgets#1",
  number: 1,
  title: "Bug",
  body: "",
  state: "open",
  labels: [],
  assignees: [],
  milestoneId: null,
  url: "https://example.com/1",
  provider: "github",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const milestone: IMilestone = {
  id: "1",
  number: 1,
  title: "v1.0",
  description: "",
  state: "open",
  dueOn: null,
  url: "https://example.com/m1",
  provider: "github",
};

function makeProvider(capabilities: ProviderCapabilities): IProjectProvider {
  return {
    getCapabilities: vi.fn().mockResolvedValue(capabilities),
    listIssues: vi.fn().mockResolvedValue([issue]),
    getIssue: vi.fn().mockResolvedValue(issue),
    createIssue: vi.fn().mockResolvedValue(issue),
    updateIssue: vi.fn().mockResolvedValue({ ...issue, state: "closed" }),
    listMilestones: vi.fn().mockResolvedValue([milestone]),
    getMilestone: vi.fn(),
    createMilestone: vi.fn().mockResolvedValue(milestone),
    updateMilestone: vi.fn().mockResolvedValue({ ...milestone, state: "closed" }),
  };
}

const fullAccess: ProviderCapabilities = {
  canReadIssues: true,
  canWriteIssues: true,
  canReadMilestones: true,
  canWriteMilestones: true,
};

const readOnly: ProviderCapabilities = {
  canReadIssues: true,
  canWriteIssues: false,
  canReadMilestones: true,
  canWriteMilestones: false,
};

describe("PanelController.handleMessage 'requestState'", () => {
  it("posts capabilities, issues, and milestones", async () => {
    const provider = makeProvider(fullAccess);
    const postMessage = vi.fn();
    const controller = new PanelController(provider, postMessage);

    await controller.handleMessage({ type: "requestState" });

    expect(postMessage).toHaveBeenCalledWith({
      type: "state",
      issues: [issue],
      milestones: [milestone],
      capabilities: fullAccess,
    });
  });
});

describe("PanelController.handleMessage 'updateIssue'", () => {
  it("updates and re-sends state when the account can write", async () => {
    const provider = makeProvider(fullAccess);
    const postMessage = vi.fn();
    const controller = new PanelController(provider, postMessage);

    await controller.handleMessage({ type: "updateIssue", id: issue.id, patch: { state: "closed" } });

    expect(provider.updateIssue).toHaveBeenCalledWith(issue.id, { state: "closed" });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }));
  });

  it("sends an error and does not call the provider when read-only", async () => {
    const provider = makeProvider(readOnly);
    const postMessage = vi.fn();
    const controller = new PanelController(provider, postMessage);

    await controller.handleMessage({ type: "updateIssue", id: issue.id, patch: { state: "closed" } });

    expect(provider.updateIssue).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      type: "error",
      message: expect.stringMatching(/canWriteIssues/),
    });
  });
});

describe("PanelController.handleMessage 'createIssue'", () => {
  it("creates and re-sends state when the account can write", async () => {
    const provider = makeProvider(fullAccess);
    const postMessage = vi.fn();
    const controller = new PanelController(provider, postMessage);

    await controller.handleMessage({ type: "createIssue", input: { title: "New", body: "" } });

    expect(provider.createIssue).toHaveBeenCalledWith({ title: "New", body: "" });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }));
  });
});

describe("PanelController.handleMessage 'updateMilestone'", () => {
  it("sends an error and does not call the provider when read-only", async () => {
    const provider = makeProvider(readOnly);
    const postMessage = vi.fn();
    const controller = new PanelController(provider, postMessage);

    await controller.handleMessage({ type: "updateMilestone", id: milestone.id, patch: { state: "closed" } });

    expect(provider.updateMilestone).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      type: "error",
      message: expect.stringMatching(/canWriteMilestones/),
    });
  });
});

describe("PanelController issue transition hook", () => {
  it("notifies onIssueTransition when an update closes the issue", async () => {
    const provider = makeProvider(fullAccess);
    const postMessage = vi.fn();
    const onIssueTransition = vi.fn();
    const controller = new PanelController(provider, postMessage, onIssueTransition);

    await controller.handleMessage({ type: "updateIssue", id: issue.id, patch: { state: "closed" } });

    expect(onIssueTransition).toHaveBeenCalledWith(expect.objectContaining({ state: "closed" }), "closed");
  });

  it("does not notify when the transition is 'none'", async () => {
    const provider = makeProvider(fullAccess);
    (provider.updateIssue as ReturnType<typeof vi.fn>).mockResolvedValue({ ...issue, title: "Renamed" });
    const postMessage = vi.fn();
    const onIssueTransition = vi.fn();
    const controller = new PanelController(provider, postMessage, onIssueTransition);

    await controller.handleMessage({ type: "updateIssue", id: issue.id, patch: { title: "Renamed" } });

    expect(onIssueTransition).not.toHaveBeenCalled();
  });
});

describe("PanelController error handling", () => {
  it("posts an error message when the provider throws", async () => {
    const provider = makeProvider(fullAccess);
    (provider.listIssues as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));
    const postMessage = vi.fn();
    const controller = new PanelController(provider, postMessage);

    await controller.handleMessage({ type: "requestState" });

    expect(postMessage).toHaveBeenCalledWith({ type: "error", message: "network down" });
  });
});

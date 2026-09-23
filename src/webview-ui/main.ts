// This file compiles with module:"none" into a single plain <script> —
// no bundler, no ES module graph — so it cannot use real `import`
// statements. The message shapes and the hasStateChanged logic below are
// therefore manually mirrored from src/webview/messages.ts and
// src/webview-ui/state-diff.ts (which stays the unit-tested source of
// truth for the diff algorithm); keep them in sync by hand.

function hasStateChanged<T>(previous: T | null, next: T): boolean {
  if (previous === null) {
    return true;
  }
  if (previous === next) {
    return false;
  }
  return JSON.stringify(previous) !== JSON.stringify(next);
}

interface RepositoryOptionView {
  id: string;
  label: string;
  provider: "github" | "gitlab";
  repository: string;
}

interface IssueView {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: readonly string[];
  assignees: readonly string[];
  milestoneId: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  commentsCount: number;
}

interface MilestoneView {
  id: string;
  number: number;
  title: string;
  description: string;
  state: "open" | "closed";
  dueOn: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

interface Capabilities {
  canReadIssues: boolean;
  canWriteIssues: boolean;
  canReadMilestones: boolean;
  canWriteMilestones: boolean;
}

interface AuthenticatedUser {
  username: string;
}

interface StateSnapshot {
  issues: IssueView[];
  milestones: MilestoneView[];
  capabilities: Capabilities;
  currentUser: AuthenticatedUser;
}

type OutboundMessage =
  | {
      type: "state";
      issues: IssueView[];
      milestones: MilestoneView[];
      capabilities: Capabilities;
      currentUser: AuthenticatedUser;
    }
  | { type: "repositoryOptions"; options: RepositoryOptionView[] }
  | { type: "actionSuccess"; message: string }
  | { type: "error"; message: string };

type InboundMessage =
  | { type: "requestState"; forceRefresh?: boolean }
  | { type: "selectRepository"; id: string }
  | { type: "updateIssue"; id: string; patch: Partial<Pick<IssueView, "title" | "body" | "state" | "assignees">> }
  | { type: "updateMilestone"; id: string; patch: Partial<Pick<MilestoneView, "title" | "description" | "state">> };

declare function acquireVsCodeApi(): {
  postMessage(message: InboundMessage): void;
};

const vscodeApi = acquireVsCodeApi();

let currentIssues: IssueView[] = [];
let currentMilestones: MilestoneView[] = [];
let currentCapabilities: Capabilities = {
  canReadIssues: false,
  canWriteIssues: false,
  canReadMilestones: false,
  canWriteMilestones: false,
};
let currentUser: AuthenticatedUser | null = null;
let selectedIssueId: string | null = null;
let selectedMilestoneId: string | null = null;
let lastState: StateSnapshot | null = null;

function post(message: InboundMessage): void {
  vscodeApi.postMessage(message);
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el as T;
}

let errorTimer: number | undefined;

function showError(message: string): void {
  const banner = byId<HTMLDivElement>("error-banner");
  banner.textContent = message;
  banner.hidden = false;
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(clearError, 5000);
}

function clearError(): void {
  window.clearTimeout(errorTimer);
  const banner = byId<HTMLDivElement>("error-banner");
  banner.hidden = true;
  banner.textContent = "";
}

let toastTimer: number | undefined;

function showToast(message: string): void {
  const toast = byId<HTMLDivElement>("toast");
  toast.textContent = message;
  toast.className = "toast toast-success";
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function findMilestone(milestoneId: string | null): MilestoneView | undefined {
  if (!milestoneId) {
    return undefined;
  }
  return currentMilestones.find((candidate) => candidate.id === milestoneId);
}

function renderLabelBadges(labels: readonly string[]): string {
  if (labels.length === 0) {
    return "";
  }
  return `<span class="badges">${labels
    .map((label) => `<span class="badge">${escapeHtml(label)}</span>`)
    .join("")}</span>`;
}

function renderIssueList(): void {
  const list = byId<HTMLDivElement>("issue-list");
  list.innerHTML = "";
  for (const issue of currentIssues) {
    const item = document.createElement("div");
    item.className = "item" + (issue.id === selectedIssueId ? " selected" : "");
    const stateClass = issue.state === "closed" ? " state-closed" : "";
    item.innerHTML = `<span class="number">#${issue.number}</span><span class="${stateClass}">${escapeHtml(issue.title)}</span>${renderLabelBadges(issue.labels)}`;
    item.addEventListener("click", () => {
      selectedIssueId = issue.id;
      renderIssueList();
      renderIssueDetail();
    });
    list.appendChild(item);
  }
}

function renderIssueDetail(): void {
  const detail = byId<HTMLDivElement>("issue-detail");
  const issue = currentIssues.find((candidate) => candidate.id === selectedIssueId);
  if (!issue) {
    detail.innerHTML = `<p>Select an issue to view details.</p>`;
    return;
  }

  const canWrite = currentCapabilities.canWriteIssues;
  const milestone = findMilestone(issue.milestoneId);
  const isAssignedToMe = currentUser !== null && issue.assignees.includes(currentUser.username);
  const showAssignToMe = canWrite && currentUser !== null && !isAssignedToMe;
  detail.innerHTML = `
    <div class="meta">
      <div class="meta-row"><span class="meta-key">Number</span><span class="meta-value">#${issue.number}</span></div>
      <div class="meta-row"><span class="meta-key">Link</span><span class="meta-value"><a href="${escapeAttr(issue.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(issue.url)}</a></span></div>
      <div class="meta-row"><span class="meta-key">Milestone</span><span class="meta-value">${milestone ? escapeHtml(milestone.title) : "—"}</span></div>
      <div class="meta-row"><span class="meta-key">Labels</span><span class="meta-value">${issue.labels.length > 0 ? renderLabelBadges(issue.labels) : "—"}</span></div>
      <div class="meta-row">
        <span class="meta-key">Assignees</span>
        <span class="meta-value">
          ${issue.assignees.length > 0 ? issue.assignees.map(escapeHtml).join(", ") : "—"}
          ${showAssignToMe ? '<button id="issue-assign-to-me" type="button" class="assign-to-me">Assign to me</button>' : ""}
        </span>
      </div>
      <div class="meta-row"><span class="meta-key">Comments</span><span class="meta-value">${issue.commentsCount}</span></div>
      <div class="meta-row"><span class="meta-key">Created</span><span class="meta-value">${formatDate(issue.createdAt)}</span></div>
      <div class="meta-row"><span class="meta-key">Updated</span><span class="meta-value">${formatDate(issue.updatedAt)}</span></div>
      <div class="meta-row"><span class="meta-key">Closed</span><span class="meta-value">${formatDate(issue.closedAt)}</span></div>
    </div>

    <label for="issue-title">Title</label>
    <input id="issue-title" type="text" value="${escapeAttr(issue.title)}" ${canWrite ? "" : "disabled"} />

    <label for="issue-state">State</label>
    <select id="issue-state" ${canWrite ? "" : "disabled"}>
      <option value="open" ${issue.state === "open" ? "selected" : ""}>Open</option>
      <option value="closed" ${issue.state === "closed" ? "selected" : ""}>Closed</option>
    </select>

    <label for="issue-body">Body</label>
    <textarea id="issue-body" ${canWrite ? "" : "disabled"}>${escapeHtml(issue.body)}</textarea>

    <button id="issue-save" ${canWrite ? "" : "disabled"}>Save</button>
    ${canWrite ? "" : '<p class="read-only-note">Your account does not have write access to issues.</p>'}
  `;

  if (canWrite) {
    byId<HTMLButtonElement>("issue-save").addEventListener("click", () => {
      const title = byId<HTMLInputElement>("issue-title").value;
      const state = byId<HTMLSelectElement>("issue-state").value as "open" | "closed";
      const body = byId<HTMLTextAreaElement>("issue-body").value;
      post({ type: "updateIssue", id: issue.id, patch: { title, state, body } });
    });

    if (showAssignToMe && currentUser !== null) {
      const username = currentUser.username;
      document.getElementById("issue-assign-to-me")?.addEventListener("click", () => {
        post({ type: "updateIssue", id: issue.id, patch: { assignees: [...issue.assignees, username] } });
      });
    }
  }
}

function renderMilestoneList(): void {
  const list = byId<HTMLDivElement>("milestone-list");
  list.innerHTML = "";
  for (const milestone of currentMilestones) {
    const item = document.createElement("div");
    item.className = "item" + (milestone.id === selectedMilestoneId ? " selected" : "");
    const stateClass = milestone.state === "closed" ? " state-closed" : "";
    const due = milestone.dueOn ? `<span class="due">Due ${formatDate(milestone.dueOn)}</span>` : "";
    item.innerHTML = `<span class="${stateClass}">${escapeHtml(milestone.title)}</span>${due}`;
    item.addEventListener("click", () => {
      selectedMilestoneId = milestone.id;
      renderMilestoneList();
      renderMilestoneDetail();
    });
    list.appendChild(item);
  }
}

function renderMilestoneDetail(): void {
  const detail = byId<HTMLDivElement>("milestone-detail");
  const milestone = currentMilestones.find((candidate) => candidate.id === selectedMilestoneId);
  if (!milestone) {
    detail.innerHTML = `<p>Select a milestone to view details.</p>`;
    return;
  }

  const canWrite = currentCapabilities.canWriteMilestones;
  const linkedIssues = currentIssues.filter((candidate) => candidate.milestoneId === milestone.id);
  const openCount = linkedIssues.filter((candidate) => candidate.state === "open").length;
  const closedCount = linkedIssues.length - openCount;
  detail.innerHTML = `
    <div class="meta">
      <div class="meta-row"><span class="meta-key">Number</span><span class="meta-value">#${milestone.number}</span></div>
      <div class="meta-row"><span class="meta-key">Link</span><span class="meta-value"><a href="${escapeAttr(milestone.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(milestone.url)}</a></span></div>
      <div class="meta-row"><span class="meta-key">Due</span><span class="meta-value">${formatDate(milestone.dueOn)}</span></div>
      <div class="meta-row"><span class="meta-key">Issues</span><span class="meta-value">${openCount} open, ${closedCount} closed</span></div>
      <div class="meta-row"><span class="meta-key">Created</span><span class="meta-value">${formatDate(milestone.createdAt)}</span></div>
      <div class="meta-row"><span class="meta-key">Updated</span><span class="meta-value">${formatDate(milestone.updatedAt)}</span></div>
    </div>

    <label for="milestone-title">Title</label>
    <input id="milestone-title" type="text" value="${escapeAttr(milestone.title)}" ${canWrite ? "" : "disabled"} />

    <label for="milestone-state">State</label>
    <select id="milestone-state" ${canWrite ? "" : "disabled"}>
      <option value="open" ${milestone.state === "open" ? "selected" : ""}>Open</option>
      <option value="closed" ${milestone.state === "closed" ? "selected" : ""}>Closed</option>
    </select>

    <label for="milestone-description">Description</label>
    <textarea id="milestone-description" ${canWrite ? "" : "disabled"}>${escapeHtml(milestone.description)}</textarea>

    <button id="milestone-save" ${canWrite ? "" : "disabled"}>Save</button>
    ${canWrite ? "" : '<p class="read-only-note">Your account does not have write access to milestones.</p>'}
  `;

  if (canWrite) {
    byId<HTMLButtonElement>("milestone-save").addEventListener("click", () => {
      const title = byId<HTMLInputElement>("milestone-title").value;
      const state = byId<HTMLSelectElement>("milestone-state").value as "open" | "closed";
      const description = byId<HTMLTextAreaElement>("milestone-description").value;
      post({ type: "updateMilestone", id: milestone.id, patch: { title, state, description } });
    });
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function renderRepositoryPicker(options: RepositoryOptionView[]): void {
  byId<HTMLDivElement>("repository-picker").hidden = false;
  byId<HTMLDivElement>("view-issues").hidden = true;
  byId<HTMLDivElement>("view-milestones").hidden = true;

  const container = byId<HTMLDivElement>("repository-options");
  container.innerHTML = "";
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "repository-option";
    button.textContent = option.label;
    button.addEventListener("click", () => {
      post({ type: "selectRepository", id: option.id });
    });
    container.appendChild(button);
  }
}

function setActiveTab(tab: "issues" | "milestones"): void {
  byId<HTMLButtonElement>("tab-issues").classList.toggle("active", tab === "issues");
  byId<HTMLButtonElement>("tab-milestones").classList.toggle("active", tab === "milestones");
  byId<HTMLDivElement>("view-issues").hidden = tab !== "issues";
  byId<HTMLDivElement>("view-milestones").hidden = tab !== "milestones";
}

byId<HTMLButtonElement>("tab-issues").addEventListener("click", () => setActiveTab("issues"));
byId<HTMLButtonElement>("tab-milestones").addEventListener("click", () => setActiveTab("milestones"));
byId<HTMLButtonElement>("refresh-button").addEventListener("click", () => {
  post({ type: "requestState", forceRefresh: true });
});

window.addEventListener("message", (event: MessageEvent<OutboundMessage>) => {
  const message = event.data;
  if (message.type === "state") {
    clearError();
    byId<HTMLDivElement>("repository-picker").hidden = true;
    setActiveTab(byId<HTMLButtonElement>("tab-milestones").classList.contains("active") ? "milestones" : "issues");

    const snapshot: StateSnapshot = {
      issues: message.issues,
      milestones: message.milestones,
      capabilities: message.capabilities,
      currentUser: message.currentUser,
    };
    if (!hasStateChanged(lastState, snapshot)) {
      return;
    }
    lastState = snapshot;

    currentIssues = message.issues;
    currentMilestones = message.milestones;
    currentCapabilities = message.capabilities;
    currentUser = message.currentUser;
    renderIssueList();
    renderIssueDetail();
    renderMilestoneList();
    renderMilestoneDetail();
  } else if (message.type === "repositoryOptions") {
    clearError();
    renderRepositoryPicker(message.options);
  } else if (message.type === "actionSuccess") {
    showToast(message.message);
  } else if (message.type === "error") {
    showError(message.message);
  }
});

post({ type: "requestState" });

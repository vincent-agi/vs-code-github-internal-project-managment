import { describe, expect, it } from "vitest";
import { Gitlab } from "@gitbeaker/rest";

/**
 * Every other test in this suite fakes `GitlabClient` by hand, so nothing
 * catches `GitlabProvider` drifting away from the *real* gitbeaker client's
 * actual shape (property names, method arity) — which is exactly how #37,
 * #38, and #39 shipped: `client.Labels` (should be `client.ProjectLabels`),
 * and `Issues.create`/`ProjectMilestones.create` called with the options
 * object as the second positional argument instead of `title`.
 *
 * This file asserts against the real installed `@gitbeaker/rest` package
 * instead of our own interface, so a future gitbeaker upgrade that renames
 * or reshapes any of this fails here instead of shipping silently broken
 * again.
 */
describe("real @gitbeaker/rest client shape", () => {
  const client = new Gitlab({ token: "test-token" });

  it("exposes ProjectLabels, not Labels", () => {
    expect(client.ProjectLabels).toBeDefined();
    expect((client as unknown as { Labels?: unknown }).Labels).toBeUndefined();
  });

  it("Issues.create takes (projectId, title, options) — title is positional, not a field", () => {
    expect(client.Issues.create.length).toBe(3);
  });

  it("ProjectMilestones.create takes (resourceId, title, options) — title is positional", () => {
    expect(client.ProjectMilestones.create.length).toBe(3);
  });

  it("exposes ProjectMembers for resolving usernames to numeric ids", () => {
    expect(client.ProjectMembers).toBeDefined();
    expect(typeof client.ProjectMembers.all).toBe("function");
  });
});

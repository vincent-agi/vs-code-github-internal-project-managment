import { describe, expect, it } from "vitest";
import {
  assertCanWrite,
  type ProviderCapabilities,
} from "../../src/core/providers/project-provider.interface";

const readOnly: ProviderCapabilities = {
  canReadIssues: true,
  canWriteIssues: false,
  canReadMilestones: true,
  canWriteMilestones: false,
};

const fullAccess: ProviderCapabilities = {
  canReadIssues: true,
  canWriteIssues: true,
  canReadMilestones: true,
  canWriteMilestones: true,
};

describe("assertCanWrite", () => {
  it("does not throw when the account has write access", () => {
    expect(() => assertCanWrite(fullAccess, "canWriteIssues")).not.toThrow();
  });

  it("throws when the account lacks write access", () => {
    expect(() => assertCanWrite(readOnly, "canWriteIssues")).toThrow(/canWriteIssues/);
  });

  it("throws for milestones the same way as issues", () => {
    expect(() => assertCanWrite(readOnly, "canWriteMilestones")).toThrow(/canWriteMilestones/);
  });
});

import { describe, expect, it } from "vitest";
import { approvalRequest, validateApproval } from "../src/approval-policy.js";
import type { PlanStep } from "../src/types.js";

const step: PlanStep = {
  id: "step-1",
  action: "Send reviewed message",
  tool: "send-message",
  input: { recipient: "customer@example.com", body: "Hello" },
  risk: "high",
};

const now = new Date("2026-09-08T00:00:00.000Z");

describe("approval policy", () => {
  it("accepts an exact unexpired scoped approval", () => {
    const request = approvalRequest(step);
    expect(validateApproval(request, {
      approved: true,
      reviewer: "reviewer-1",
      fingerprint: request.fingerprint,
      expiresAt: "2026-09-08T00:10:00.000Z",
      capabilities: ["send-message"],
    }, now)).toEqual({ valid: true });
  });

  it("rejects an expired approval", () => {
    const request = approvalRequest(step);
    const result = validateApproval(request, {
      approved: true,
      reviewer: "reviewer-1",
      fingerprint: request.fingerprint,
      expiresAt: "2026-09-07T23:59:59.000Z",
      capabilities: ["send-message"],
    }, now);
    expect(result).toEqual({ valid: false, reason: "Approval has expired" });
  });

  it("rejects a fingerprint from a different action", () => {
    const request = approvalRequest(step);
    const other = approvalRequest({ ...step, input: { recipient: "other@example.com", body: "Hello" } });
    const result = validateApproval(request, {
      approved: true,
      reviewer: "reviewer-1",
      fingerprint: other.fingerprint,
      expiresAt: "2026-09-08T00:10:00.000Z",
      capabilities: ["send-message"],
    }, now);
    expect(result).toEqual({ valid: false, reason: "Approval fingerprint does not match the planned action" });
  });

  it("rejects an approval that does not grant the required capability", () => {
    const request = approvalRequest(step);
    const result = validateApproval(request, {
      approved: true,
      reviewer: "reviewer-1",
      fingerprint: request.fingerprint,
      expiresAt: "2026-09-08T00:10:00.000Z",
      capabilities: ["draft-message"],
    }, now);
    expect(result).toEqual({ valid: false, reason: "Approval does not grant capability: send-message" });
  });

  it("rejects an approval that grants unrelated capabilities too", () => {
    const request = approvalRequest(step);
    const result = validateApproval(request, {
      approved: true,
      reviewer: "reviewer-1",
      fingerprint: request.fingerprint,
      expiresAt: "2026-09-08T00:10:00.000Z",
      capabilities: ["send-message", "delete-record"],
    }, now);
    expect(result).toEqual({ valid: false, reason: "Approval grants capabilities beyond the exact planned action" });
  });
});

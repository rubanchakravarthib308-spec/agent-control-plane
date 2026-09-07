import { createHash } from "node:crypto";
import type { ApprovalDecision, ApprovalRequest, PlanStep } from "./types.js";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stable(child)]),
    );
  }
  return value;
}

export function approvalFingerprint(step: PlanStep): string {
  const payload = JSON.stringify(stable({
    id: step.id,
    action: step.action,
    tool: step.tool,
    input: step.input,
    risk: step.risk,
  }));
  return createHash("sha256").update(payload).digest("hex");
}

export function approvalRequest(step: PlanStep): ApprovalRequest {
  return {
    step,
    fingerprint: approvalFingerprint(step),
    requiredCapability: step.tool,
  };
}

export function validateApproval(
  request: ApprovalRequest,
  decision: ApprovalDecision,
  now: Date,
): { valid: true } | { valid: false; reason: string } {
  if (!decision.approved) return { valid: false, reason: decision.note ?? "Human reviewer denied the action" };
  if (!decision.fingerprint) return { valid: false, reason: "Approval is missing an action fingerprint" };
  if (decision.fingerprint !== request.fingerprint) return { valid: false, reason: "Approval fingerprint does not match the planned action" };
  if (!decision.expiresAt) return { valid: false, reason: "Approval is missing an expiration time" };

  const expiresAt = new Date(decision.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return { valid: false, reason: "Approval expiration is invalid" };
  if (expiresAt.getTime() <= now.getTime()) return { valid: false, reason: "Approval has expired" };

  if (!decision.capabilities?.includes(request.requiredCapability)) {
    return { valid: false, reason: `Approval does not grant capability: ${request.requiredCapability}` };
  }

  return { valid: true };
}

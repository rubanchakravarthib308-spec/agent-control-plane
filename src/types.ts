export type RiskLevel = "low" | "medium" | "high";

export interface AgentGoal {
  id: string;
  objective: string;
}

export interface PlanStep {
  id: string;
  action: string;
  tool: string;
  input: Record<string, unknown>;
  risk: RiskLevel;
}

export interface ToolResult {
  ok: boolean;
  output: unknown;
}

export interface VerificationResult {
  passed: boolean;
  reason: string;
}

export interface ApprovalDecision {
  approved: boolean;
  reviewer: string;
  note?: string;
}

export type AuditEventType =
  | "GOAL_RECEIVED"
  | "PLAN_CREATED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "TOOL_EXECUTED"
  | "VERIFICATION_PASSED"
  | "VERIFICATION_FAILED"
  | "RUN_COMPLETED"
  | "RUN_FAILED";

export interface AuditEvent {
  at: string;
  type: AuditEventType;
  message: string;
  metadata?: Record<string, unknown>;
}

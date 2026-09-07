import type {
  AgentGoal,
  ApprovalDecision,
  AuditEvent,
  PlanStep,
  VerificationResult,
} from "./types.js";

export type RunStatus = "running" | "completed" | "blocked" | "failed";

export type StepStatus =
  | "planned"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "executed"
  | "verified"
  | "blocked"
  | "failed";

export interface RunRecord {
  id: string;
  goal: AgentGoal;
  status: RunStatus;
  createdAt: string;
  finishedAt?: string;
}

export interface StepRecord {
  runId: string;
  step: PlanStep;
  order: number;
  status: StepStatus;
  approval?: ApprovalDecision;
  output?: unknown;
  verification?: VerificationResult;
}

export interface RunStore {
  createRun(run: RunRecord): Promise<void>;
  savePlan(runId: string, steps: PlanStep[]): Promise<void>;
  setStepStatus(runId: string, stepId: string, status: StepStatus): Promise<void>;
  recordApproval(runId: string, stepId: string, approval: ApprovalDecision): Promise<void>;
  recordExecution(runId: string, stepId: string, output: unknown): Promise<void>;
  recordVerification(runId: string, stepId: string, verification: VerificationResult): Promise<void>;
  appendAudit(runId: string, event: AuditEvent): Promise<void>;
  finishRun(runId: string, status: Exclude<RunStatus, "running">, finishedAt: string): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  getSteps(runId: string): Promise<StepRecord[]>;
  listAudit(runId: string): Promise<AuditEvent[]>;
}

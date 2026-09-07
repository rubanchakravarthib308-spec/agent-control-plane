import type { ApprovalDecision, AuditEvent, PlanStep, VerificationResult } from "./types.js";
import type { RunRecord, RunStatus, RunStore, StepRecord, StepStatus } from "./run-store.js";

export class InMemoryRunStore implements RunStore {
  private readonly runs = new Map<string, RunRecord>();
  private readonly steps = new Map<string, StepRecord[]>();
  private readonly audit = new Map<string, AuditEvent[]>();
  private readonly executionClaims = new Set<string>();

  async createRun(run: RunRecord): Promise<void> {
    if (this.runs.has(run.id)) throw new Error(`Run already exists: ${run.id}`);
    this.runs.set(run.id, structuredClone(run));
    this.steps.set(run.id, []);
    this.audit.set(run.id, []);
  }

  async savePlan(runId: string, steps: PlanStep[]): Promise<void> {
    this.assertRun(runId);
    this.steps.set(
      runId,
      steps.map((step, order) => ({ runId, step: structuredClone(step), order, status: "planned" as const })),
    );
  }

  async setStepStatus(runId: string, stepId: string, status: StepStatus): Promise<void> {
    this.step(runId, stepId).status = status;
  }

  async recordApproval(runId: string, stepId: string, approval: ApprovalDecision): Promise<void> {
    this.step(runId, stepId).approval = structuredClone(approval);
  }

  async claimExecution(idempotencyKey: string, runId: string, stepId: string, _claimedAt: string): Promise<boolean> {
    this.assertRun(runId);
    this.step(runId, stepId);
    if (this.executionClaims.has(idempotencyKey)) return false;
    this.executionClaims.add(idempotencyKey);
    return true;
  }

  async recordExecution(runId: string, stepId: string, output: unknown): Promise<void> {
    this.step(runId, stepId).output = structuredClone(output);
  }

  async recordVerification(runId: string, stepId: string, verification: VerificationResult): Promise<void> {
    this.step(runId, stepId).verification = structuredClone(verification);
  }

  async appendAudit(runId: string, event: AuditEvent): Promise<void> {
    this.assertRun(runId);
    this.audit.get(runId)!.push(structuredClone(event));
  }

  async finishRun(runId: string, status: Exclude<RunStatus, "running">, finishedAt: string): Promise<void> {
    const run = this.assertRun(runId);
    run.status = status;
    run.finishedAt = finishedAt;
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }

  async getSteps(runId: string): Promise<StepRecord[]> {
    return structuredClone(this.steps.get(runId) ?? []);
  }

  async listAudit(runId: string): Promise<AuditEvent[]> {
    return structuredClone(this.audit.get(runId) ?? []);
  }

  private assertRun(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown run: ${runId}`);
    return run;
  }

  private step(runId: string, stepId: string): StepRecord {
    const step = this.steps.get(runId)?.find((record) => record.step.id === stepId);
    if (!step) throw new Error(`Unknown step ${stepId} for run ${runId}`);
    return step;
  }
}

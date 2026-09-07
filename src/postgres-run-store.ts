import postgres, { type Sql } from "postgres";
import type { ApprovalDecision, AuditEvent, PlanStep, VerificationResult } from "./types.js";
import type { RunRecord, RunStatus, RunStore, StepRecord, StepStatus } from "./run-store.js";

type SqlJsonValue = Parameters<Sql["json"]>[0];

function toSqlJson(value: unknown): SqlJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as SqlJsonValue;
}

export class PostgresRunStore implements RunStore {
  private readonly sql: Sql;

  constructor(connectionString: string, sql?: Sql) {
    this.sql = sql ?? postgres(connectionString, { max: 5 });
  }

  async createRun(run: RunRecord): Promise<void> {
    await this.sql`insert into agent_runs (id, goal_id, objective, status, created_at) values (${run.id}, ${run.goal.id}, ${run.goal.objective}, ${run.status}, ${run.createdAt})`;
  }

  async savePlan(runId: string, steps: PlanStep[]): Promise<void> {
    if (steps.length === 0) return;
    await this.sql.begin(async (tx) => {
      for (let order = 0; order < steps.length; order += 1) {
        const step = steps[order]!;
        await tx`insert into agent_run_steps (run_id, step_id, step_order, action, tool, input, risk, status) values (${runId}, ${step.id}, ${order}, ${step.action}, ${step.tool}, ${tx.json(toSqlJson(step.input))}, ${step.risk}, 'planned')`;
      }
    });
  }

  async setStepStatus(runId: string, stepId: string, status: StepStatus): Promise<void> {
    await this.sql`update agent_run_steps set status = ${status} where run_id = ${runId} and step_id = ${stepId}`;
  }

  async recordApproval(runId: string, stepId: string, approval: ApprovalDecision): Promise<void> {
    await this.sql`update agent_run_steps set approval = ${this.sql.json(toSqlJson(approval))} where run_id = ${runId} and step_id = ${stepId}`;
  }

  async claimExecution(idempotencyKey: string, runId: string, stepId: string, claimedAt: string): Promise<boolean> {
    const rows = await this.sql`
      insert into agent_execution_claims (idempotency_key, run_id, step_id, claimed_at)
      values (${idempotencyKey}, ${runId}, ${stepId}, ${claimedAt})
      on conflict (idempotency_key) do nothing
      returning idempotency_key
    `;
    return rows.length === 1;
  }

  async recordExecution(runId: string, stepId: string, output: unknown): Promise<void> {
    await this.sql`update agent_run_steps set output = ${this.sql.json(toSqlJson(output))} where run_id = ${runId} and step_id = ${stepId}`;
  }

  async recordVerification(runId: string, stepId: string, verification: VerificationResult): Promise<void> {
    await this.sql`update agent_run_steps set verification = ${this.sql.json(toSqlJson(verification))} where run_id = ${runId} and step_id = ${stepId}`;
  }

  async appendAudit(runId: string, event: AuditEvent): Promise<void> {
    await this.sql`insert into agent_audit_events (run_id, occurred_at, event_type, message, metadata) values (${runId}, ${event.at}, ${event.type}, ${event.message}, ${this.sql.json(toSqlJson(event.metadata ?? {}))})`;
  }

  async finishRun(runId: string, status: Exclude<RunStatus, "running">, finishedAt: string): Promise<void> {
    await this.sql`update agent_runs set status = ${status}, finished_at = ${finishedAt} where id = ${runId}`;
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const rows = await this.sql`select id, goal_id, objective, status, created_at, finished_at from agent_runs where id = ${runId}`;
    const row = rows[0];
    if (!row) return null;
    return { id: String(row.id), goal: { id: String(row.goal_id), objective: String(row.objective) }, status: row.status as RunStatus, createdAt: new Date(row.created_at as string | Date).toISOString(), finishedAt: row.finished_at ? new Date(row.finished_at as string | Date).toISOString() : undefined };
  }

  async getSteps(runId: string): Promise<StepRecord[]> {
    const rows = await this.sql`select run_id, step_id, step_order, action, tool, input, risk, status, approval, output, verification from agent_run_steps where run_id = ${runId} order by step_order asc`;
    return rows.map((row) => ({ runId: String(row.run_id), order: Number(row.step_order), status: row.status as StepStatus, step: { id: String(row.step_id), action: String(row.action), tool: String(row.tool), input: (row.input ?? {}) as Record<string, unknown>, risk: row.risk as PlanStep["risk"] }, approval: (row.approval ?? undefined) as ApprovalDecision | undefined, output: row.output, verification: (row.verification ?? undefined) as VerificationResult | undefined }));
  }

  async listAudit(runId: string): Promise<AuditEvent[]> {
    const rows = await this.sql`select occurred_at, event_type, message, metadata from agent_audit_events where run_id = ${runId} order by id asc`;
    return rows.map((row) => ({ at: new Date(row.occurred_at as string | Date).toISOString(), type: row.event_type as AuditEvent["type"], message: String(row.message), metadata: (row.metadata ?? undefined) as Record<string, unknown> | undefined }));
  }
}

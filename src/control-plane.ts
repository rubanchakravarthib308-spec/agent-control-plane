import type {
  AgentGoal,
  ApprovalDecision,
  ApprovalRequest,
  AuditEvent,
  PlanStep,
  VerificationResult,
} from "./types.js";
import { approvalRequest, validateApproval } from "./approval-policy.js";
import { InMemoryRunStore } from "./memory-run-store.js";
import { runPlanner, type PlannerLike } from "./planner.js";
import type { RunStore, StepStatus } from "./run-store.js";
import { ToolRegistry } from "./tool-registry.js";

export interface ControlPlaneDeps {
  registry: ToolRegistry;
  planner: PlannerLike;
  verify: (step: PlanStep, output: unknown) => Promise<VerificationResult>;
  approve: (request: ApprovalRequest) => Promise<ApprovalDecision>;
  store?: RunStore;
  now?: () => Date;
}

export interface RunResult {
  runId: string;
  status: "completed" | "blocked" | "failed";
  audit: AuditEvent[];
}

export class AgentControlPlane {
  private readonly store: RunStore;

  constructor(private readonly deps: ControlPlaneDeps) {
    this.store = deps.store ?? new InMemoryRunStore();
  }

  async run(goal: AgentGoal): Promise<RunResult> {
    const audit: AuditEvent[] = [];
    const now = this.deps.now ?? (() => new Date());
    const runId = goal.id;

    await this.store.createRun({ id: runId, goal, status: "running", createdAt: now().toISOString() });

    const log = async (type: AuditEvent["type"], message: string, metadata?: Record<string, unknown>) => {
      const event: AuditEvent = { at: now().toISOString(), type, message, metadata };
      audit.push(event);
      await this.store.appendAudit(runId, event);
    };

    const finish = async (status: RunResult["status"]): Promise<RunResult> => {
      await this.store.finishRun(runId, status, now().toISOString());
      return { runId, status, audit };
    };

    const stepStatus = async (stepId: string, status: StepStatus) => this.store.setStepStatus(runId, stepId, status);

    await log("GOAL_RECEIVED", goal.objective, { goalId: goal.id, runId });

    try {
      const plan = await runPlanner(this.deps.planner, goal);
      await this.store.savePlan(runId, plan);
      await log("PLAN_CREATED", `${plan.length} step(s) planned`);

      for (const step of plan) {
        if (step.risk === "high") {
          const request = approvalRequest(step);
          await stepStatus(step.id, "awaiting_approval");
          await log("APPROVAL_REQUESTED", `Approval required for ${step.action}`, {
            stepId: step.id,
            fingerprint: request.fingerprint,
            requiredCapability: request.requiredCapability,
          });

          const decision = await this.deps.approve(request);
          await this.store.recordApproval(runId, step.id, decision);
          const validation = validateApproval(request, decision, now());

          if (!validation.valid) {
            await stepStatus(step.id, "blocked");
            await log("APPROVAL_DENIED", validation.reason, {
              reviewer: decision.reviewer,
              stepId: step.id,
              fingerprint: request.fingerprint,
              requiredCapability: request.requiredCapability,
            });
            return finish("blocked");
          }

          await stepStatus(step.id, "approved");
          await log("APPROVAL_GRANTED", decision.note ?? "Human reviewer approved the exact scoped action", {
            reviewer: decision.reviewer,
            stepId: step.id,
            fingerprint: request.fingerprint,
            expiresAt: decision.expiresAt,
            capabilities: decision.capabilities,
          });
        }

        const idempotencyKey = `${runId}:${step.id}`;
        const claimed = await this.store.claimExecution(idempotencyKey, runId, step.id, now().toISOString());
        if (!claimed) {
          await stepStatus(step.id, "blocked");
          await log("REPLAY_BLOCKED", `Duplicate execution blocked for ${step.id}`, { stepId: step.id, idempotencyKey });
          return finish("blocked");
        }
        await log("EXECUTION_CLAIMED", `Execution claim acquired for ${step.id}`, { stepId: step.id, idempotencyKey });

        await stepStatus(step.id, "executing");
        const result = await this.deps.registry.execute(step.tool, step.input);
        await this.store.recordExecution(runId, step.id, result.output);
        await log("TOOL_EXECUTED", `${step.tool}: ${result.ok ? "ok" : "failed"}`, { stepId: step.id, idempotencyKey });
        if (!result.ok) {
          await stepStatus(step.id, "failed");
          await log("RUN_FAILED", `Tool execution failed for ${step.id}`);
          return finish("failed");
        }

        await stepStatus(step.id, "executed");
        const verification = await this.deps.verify(step, result.output);
        await this.store.recordVerification(runId, step.id, verification);
        await log(verification.passed ? "VERIFICATION_PASSED" : "VERIFICATION_FAILED", verification.reason, { stepId: step.id });
        if (!verification.passed) {
          await stepStatus(step.id, "failed");
          await log("RUN_FAILED", `Verification failed for ${step.id}`);
          return finish("failed");
        }
        await stepStatus(step.id, "verified");
      }

      await log("RUN_COMPLETED", "All planned steps executed and verified");
      return finish("completed");
    } catch (error) {
      await log("RUN_FAILED", error instanceof Error ? error.message : "Unknown control-plane failure");
      return finish("failed");
    }
  }
}

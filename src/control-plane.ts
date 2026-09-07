import type {
  AgentGoal,
  ApprovalDecision,
  AuditEvent,
  PlanStep,
  VerificationResult,
} from "./types.js";
import { ToolRegistry } from "./tool-registry.js";

export interface ControlPlaneDeps {
  registry: ToolRegistry;
  planner: (goal: AgentGoal) => Promise<PlanStep[]>;
  verify: (step: PlanStep, output: unknown) => Promise<VerificationResult>;
  approve: (step: PlanStep) => Promise<ApprovalDecision>;
  now?: () => Date;
}

export interface RunResult {
  status: "completed" | "blocked" | "failed";
  audit: AuditEvent[];
}

export class AgentControlPlane {
  constructor(private readonly deps: ControlPlaneDeps) {}

  async run(goal: AgentGoal): Promise<RunResult> {
    const audit: AuditEvent[] = [];
    const now = this.deps.now ?? (() => new Date());
    const log = (type: AuditEvent["type"], message: string, metadata?: Record<string, unknown>) => {
      audit.push({ at: now().toISOString(), type, message, metadata });
    };

    log("GOAL_RECEIVED", goal.objective, { goalId: goal.id });

    try {
      const plan = await this.deps.planner(goal);
      log("PLAN_CREATED", `${plan.length} step(s) planned`);

      for (const step of plan) {
        if (step.risk === "high") {
          log("APPROVAL_REQUESTED", `Approval required for ${step.action}`, { stepId: step.id });
          const decision = await this.deps.approve(step);

          if (!decision.approved) {
            log("APPROVAL_DENIED", decision.note ?? "Human reviewer denied the action", {
              reviewer: decision.reviewer,
              stepId: step.id,
            });
            return { status: "blocked", audit };
          }

          log("APPROVAL_GRANTED", decision.note ?? "Human reviewer approved the action", {
            reviewer: decision.reviewer,
            stepId: step.id,
          });
        }

        const result = await this.deps.registry.execute(step.tool, step.input);
        log("TOOL_EXECUTED", `${step.tool}: ${result.ok ? "ok" : "failed"}`, { stepId: step.id });

        if (!result.ok) {
          log("RUN_FAILED", `Tool execution failed for ${step.id}`);
          return { status: "failed", audit };
        }

        const verification = await this.deps.verify(step, result.output);
        log(
          verification.passed ? "VERIFICATION_PASSED" : "VERIFICATION_FAILED",
          verification.reason,
          { stepId: step.id },
        );

        if (!verification.passed) {
          log("RUN_FAILED", `Verification failed for ${step.id}`);
          return { status: "failed", audit };
        }
      }

      log("RUN_COMPLETED", "All planned steps executed and verified");
      return { status: "completed", audit };
    } catch (error) {
      log("RUN_FAILED", error instanceof Error ? error.message : "Unknown control-plane failure");
      return { status: "failed", audit };
    }
  }
}

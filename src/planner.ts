import { z } from "zod";
import type { AgentGoal, PlanStep } from "./types.js";

const PlanStepSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  tool: z.string().min(1),
  input: z.record(z.unknown()),
  risk: z.enum(["low", "medium", "high"]),
}).strict();

const PlanSchema = z.array(PlanStepSchema).min(1).max(50).superRefine((steps, ctx) => {
  const seen = new Set<string>();
  for (const [index, step] of steps.entries()) {
    if (seen.has(step.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "id"],
        message: `Duplicate step id: ${step.id}`,
      });
    }
    seen.add(step.id);
  }
});

const ModelEnvelopeSchema = z.object({ steps: z.unknown() }).strict();

export class PlanValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PlanValidationError";
  }
}

export interface Planner {
  plan(goal: AgentGoal): Promise<PlanStep[]>;
}

export type PlannerFunction = (goal: AgentGoal) => Promise<PlanStep[]>;
export type PlannerLike = Planner | PlannerFunction;

export interface PlanningModelRequest {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Provider-neutral model boundary. An OpenAI, Anthropic, Gemini, local model,
 * or test fake can implement this interface without gaining execution access.
 */
export interface PlanningModelProvider {
  generate(request: PlanningModelRequest): Promise<unknown>;
}

export interface LLMPlannerOptions {
  availableTools: readonly string[];
  maxSteps?: number;
}

export function validatePlan(candidate: unknown): PlanStep[] {
  const parsed = PlanSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new PlanValidationError(`Planner output failed validation: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return parsed.data;
}

export async function runPlanner(planner: PlannerLike, goal: AgentGoal): Promise<PlanStep[]> {
  const candidate = typeof planner === "function" ? await planner(goal) : await planner.plan(goal);
  return validatePlan(candidate);
}

/** Deterministic adapter retained for offline tests and reproducible demos. */
export class DeterministicPlanner implements Planner {
  constructor(private readonly build: PlannerFunction) {}

  async plan(goal: AgentGoal): Promise<PlanStep[]> {
    return validatePlan(await this.build(goal));
  }
}

export class LLMPlannerAdapter implements Planner {
  private readonly availableTools: readonly string[];
  private readonly maxSteps: number;

  constructor(
    private readonly provider: PlanningModelProvider,
    options: LLMPlannerOptions,
  ) {
    if (options.availableTools.length === 0) throw new Error("LLM planner requires at least one available tool");
    this.availableTools = [...new Set(options.availableTools)];
    this.maxSteps = options.maxSteps ?? 20;
    if (!Number.isInteger(this.maxSteps) || this.maxSteps < 1 || this.maxSteps > 50) {
      throw new Error("maxSteps must be an integer between 1 and 50");
    }
  }

  async plan(goal: AgentGoal): Promise<PlanStep[]> {
    const raw = await this.provider.generate({
      systemPrompt: this.systemPrompt(),
      userPrompt: `Goal ID: ${goal.id}\nObjective: ${goal.objective}`,
    });

    const envelope = this.parseEnvelope(raw);
    const plan = validatePlan(envelope.steps);

    if (plan.length > this.maxSteps) {
      throw new PlanValidationError(`Planner returned ${plan.length} steps; maximum allowed is ${this.maxSteps}`);
    }

    for (const step of plan) {
      if (!this.availableTools.includes(step.tool)) {
        throw new PlanValidationError(`Planner requested unavailable tool: ${step.tool}`);
      }
    }

    return plan;
  }

  private parseEnvelope(raw: unknown): { steps: unknown } {
    let candidate = raw;
    if (typeof raw === "string") {
      try {
        candidate = JSON.parse(raw) as unknown;
      } catch (error) {
        throw new PlanValidationError("Model response was not valid JSON", { cause: error });
      }
    }

    const parsed = ModelEnvelopeSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new PlanValidationError("Model response must be a JSON object containing only a steps field");
    }
    return parsed.data;
  }

  private systemPrompt(): string {
    return [
      "You are a planning component. You can propose steps but you have no authority to execute tools.",
      `Return strict JSON only: {\"steps\":[{\"id\":\"step-1\",\"action\":\"...\",\"tool\":\"...\",\"input\":{},\"risk\":\"low|medium|high\"}]}`,
      `Use at most ${this.maxSteps} steps.`,
      `Available tools: ${this.availableTools.join(", ")}.`,
      "Use only available tools. Assign high risk to steps with meaningful external side effects or irreversible changes.",
      "Do not include markdown, commentary, approvals, execution claims, verification results, or any field outside the schema.",
    ].join("\n");
  }
}

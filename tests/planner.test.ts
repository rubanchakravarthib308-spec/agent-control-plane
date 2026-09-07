import { describe, expect, it, vi } from "vitest";
import { AgentControlPlane } from "../src/control-plane.js";
import {
  DeterministicPlanner,
  LLMPlannerAdapter,
  PlanValidationError,
  validatePlan,
  type PlanningModelProvider,
} from "../src/planner.js";
import { ToolRegistry } from "../src/tool-registry.js";

const goal = { id: "goal-1", objective: "Safely prepare a customer update" };
const validSteps = [
  {
    id: "step-1",
    action: "Read customer record",
    tool: "read-record",
    input: { customerId: "c-1" },
    risk: "low" as const,
  },
];

describe("planner boundary", () => {
  it("retains a deterministic planner for offline tests", async () => {
    const planner = new DeterministicPlanner(async () => validSteps);
    await expect(planner.plan(goal)).resolves.toEqual(validSteps);
  });

  it("accepts a provider-neutral object response", async () => {
    const provider: PlanningModelProvider = {
      generate: vi.fn().mockResolvedValue({ steps: validSteps }),
    };
    const planner = new LLMPlannerAdapter(provider, { availableTools: ["read-record"] });

    await expect(planner.plan(goal)).resolves.toEqual(validSteps);
    expect(provider.generate).toHaveBeenCalledOnce();
  });

  it("accepts strict JSON text from a provider", async () => {
    const provider: PlanningModelProvider = {
      generate: vi.fn().mockResolvedValue(JSON.stringify({ steps: validSteps })),
    };
    const planner = new LLMPlannerAdapter(provider, { availableTools: ["read-record"] });

    await expect(planner.plan(goal)).resolves.toEqual(validSteps);
  });

  it("rejects malformed JSON before execution authority is reached", async () => {
    const provider: PlanningModelProvider = {
      generate: vi.fn().mockResolvedValue("not json"),
    };
    const planner = new LLMPlannerAdapter(provider, { availableTools: ["read-record"] });

    await expect(planner.plan(goal)).rejects.toThrow("Model response was not valid JSON");
  });

  it("rejects duplicate step ids", () => {
    expect(() => validatePlan([validSteps[0], { ...validSteps[0] }])).toThrow(PlanValidationError);
  });

  it("rejects unavailable tools", async () => {
    const provider: PlanningModelProvider = {
      generate: vi.fn().mockResolvedValue({
        steps: [{ ...validSteps[0], tool: "delete-everything" }],
      }),
    };
    const planner = new LLMPlannerAdapter(provider, { availableTools: ["read-record"] });

    await expect(planner.plan(goal)).rejects.toThrow("Planner requested unavailable tool: delete-everything");
  });

  it("prevents malformed model output from invoking tools", async () => {
    const provider: PlanningModelProvider = {
      generate: vi.fn().mockResolvedValue({
        steps: [{ id: "step-1", action: "Bad step", tool: "read-record", input: {}, risk: "invalid" }],
      }),
    };
    const planner = new LLMPlannerAdapter(provider, { availableTools: ["read-record"] });
    const registry = new ToolRegistry();
    const execute = vi.fn().mockResolvedValue({ ok: true, output: {} });
    registry.register("read-record", execute);

    const cp = new AgentControlPlane({
      registry,
      planner,
      approve: async () => ({ approved: false, reviewer: "unused" }),
      verify: async () => ({ passed: true, reason: "unused" }),
    });

    const result = await cp.run(goal);
    expect(result.status).toBe("failed");
    expect(execute).not.toHaveBeenCalled();
    expect(result.audit.at(-1)?.type).toBe("RUN_FAILED");
    expect(result.audit.at(-1)?.message).toContain("Planner output failed validation");
  });
});

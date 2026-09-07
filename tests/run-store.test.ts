import { describe, expect, it } from "vitest";
import { AgentControlPlane } from "../src/control-plane.js";
import { InMemoryRunStore } from "../src/memory-run-store.js";
import { ToolRegistry } from "../src/tool-registry.js";

function registry() {
  const registry = new ToolRegistry();
  registry.register("write-record", async () => ({ ok: true, output: { version: 2 } }));
  return registry;
}

describe("RunStore lifecycle", () => {
  it("persists run, step, approval, execution, verification, and audit state", async () => {
    const store = new InMemoryRunStore();
    const cp = new AgentControlPlane({
      store,
      registry: registry(),
      planner: async () => [
        {
          id: "step-1",
          action: "Update customer record",
          tool: "write-record",
          input: { customerId: "c-1" },
          risk: "high",
        },
      ],
      approve: async () => ({ approved: true, reviewer: "human-reviewer", note: "Reviewed exact change" }),
      verify: async () => ({ passed: true, reason: "Read-back matched" }),
      now: (() => {
        let tick = 0;
        return () => new Date(Date.UTC(2026, 8, 8, 0, 0, tick++));
      })(),
    });

    const result = await cp.run({ id: "run-1", objective: "Safely update a customer record" });
    expect(result.status).toBe("completed");

    const run = await store.getRun("run-1");
    expect(run?.status).toBe("completed");
    expect(run?.finishedAt).toBeDefined();

    const steps = await store.getSteps("run-1");
    expect(steps).toHaveLength(1);
    expect(steps[0]?.status).toBe("verified");
    expect(steps[0]?.approval?.approved).toBe(true);
    expect(steps[0]?.output).toEqual({ version: 2 });
    expect(steps[0]?.verification?.passed).toBe(true);

    const audit = await store.listAudit("run-1");
    expect(audit.map((event) => event.type)).toEqual([
      "GOAL_RECEIVED",
      "PLAN_CREATED",
      "APPROVAL_REQUESTED",
      "APPROVAL_GRANTED",
      "TOOL_EXECUTED",
      "VERIFICATION_PASSED",
      "RUN_COMPLETED",
    ]);
  });

  it("persists a denied high-risk step as blocked without executing the tool", async () => {
    const store = new InMemoryRunStore();
    let executions = 0;
    const tools = new ToolRegistry();
    tools.register("dangerous-tool", async () => {
      executions += 1;
      return { ok: true, output: {} };
    });

    const cp = new AgentControlPlane({
      store,
      registry: tools,
      planner: async () => [
        { id: "step-1", action: "Delete record", tool: "dangerous-tool", input: {}, risk: "high" },
      ],
      approve: async () => ({ approved: false, reviewer: "human-reviewer", note: "Not authorized" }),
      verify: async () => ({ passed: true, reason: "unused" }),
    });

    await cp.run({ id: "run-2", objective: "Delete record" });

    expect(executions).toBe(0);
    expect((await store.getRun("run-2"))?.status).toBe("blocked");
    expect((await store.getSteps("run-2"))[0]?.status).toBe("blocked");
  });
});

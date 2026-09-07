import { describe, expect, it } from "vitest";
import { AgentControlPlane } from "../src/control-plane.js";
import { ToolRegistry } from "../src/tool-registry.js";

function registryWithOkTool() {
  const registry = new ToolRegistry();
  registry.register("safe-tool", async () => ({ ok: true, output: { done: true } }));
  return registry;
}

describe("AgentControlPlane", () => {
  it("completes low-risk verified work", async () => {
    const cp = new AgentControlPlane({
      registry: registryWithOkTool(),
      planner: async () => [{ id: "1", action: "Read data", tool: "safe-tool", input: {}, risk: "low" }],
      approve: async () => ({ approved: false, reviewer: "unused" }),
      verify: async () => ({ passed: true, reason: "verified" }),
    });

    const result = await cp.run({ id: "g1", objective: "Read data safely" });
    expect(result.status).toBe("completed");
    expect(result.audit.some((e) => e.type === "RUN_COMPLETED")).toBe(true);
  });

  it("blocks high-risk work when a human denies approval", async () => {
    const cp = new AgentControlPlane({
      registry: registryWithOkTool(),
      planner: async () => [{ id: "1", action: "Send message", tool: "safe-tool", input: {}, risk: "high" }],
      approve: async () => ({ approved: false, reviewer: "ruban", note: "Needs revision" }),
      verify: async () => ({ passed: true, reason: "verified" }),
    });

    const result = await cp.run({ id: "g2", objective: "Send reviewed message" });
    expect(result.status).toBe("blocked");
    expect(result.audit.some((e) => e.type === "APPROVAL_DENIED")).toBe(true);
  });

  it("fails when post-action verification fails", async () => {
    const cp = new AgentControlPlane({
      registry: registryWithOkTool(),
      planner: async () => [{ id: "1", action: "Update record", tool: "safe-tool", input: {}, risk: "low" }],
      approve: async () => ({ approved: true, reviewer: "ruban" }),
      verify: async () => ({ passed: false, reason: "read-back did not match" }),
    });

    const result = await cp.run({ id: "g3", objective: "Update and verify record" });
    expect(result.status).toBe("failed");
    expect(result.audit.some((e) => e.type === "VERIFICATION_FAILED")).toBe(true);
  });
});

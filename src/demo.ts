import { AgentControlPlane } from "./control-plane.js";
import { ToolRegistry } from "./tool-registry.js";

const registry = new ToolRegistry();
registry.register("draft-message", async (input) => ({
  ok: true,
  output: { draft: `Prepared outreach for ${String(input.recipient ?? "unknown recipient")}` },
}));
registry.register("send-message", async (input) => ({
  ok: true,
  output: { sent: true, recipient: input.recipient },
}));

const controlPlane = new AgentControlPlane({
  registry,
  planner: async () => [
    {
      id: "step-1",
      action: "Draft outreach",
      tool: "draft-message",
      input: { recipient: "example@company.com" },
      risk: "low",
    },
    {
      id: "step-2",
      action: "Send outreach",
      tool: "send-message",
      input: { recipient: "example@company.com" },
      risk: "high",
    },
  ],
  approve: async (step) => ({
    approved: true,
    reviewer: "demo-human-reviewer",
    note: `Approved ${step.action} in demo mode`,
  }),
  verify: async (_step, output) => ({
    passed: output !== undefined,
    reason: output !== undefined ? "Output present and structurally valid" : "Missing output",
  }),
});

const result = await controlPlane.run({
  id: "demo-goal-1",
  objective: "Prepare and send a reviewed outreach message",
});

console.log(JSON.stringify(result, null, 2));

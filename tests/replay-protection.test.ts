import { describe, expect, it } from "vitest";
import { InMemoryRunStore } from "../src/memory-run-store.js";

async function preparedStore() {
  const store = new InMemoryRunStore();
  await store.createRun({
    id: "run-1",
    goal: { id: "run-1", objective: "Safely execute one action" },
    status: "running",
    createdAt: new Date(0).toISOString(),
  });
  await store.savePlan("run-1", [
    { id: "step-1", action: "Send approved message", tool: "safe-tool", input: {}, risk: "high" },
  ]);
  return store;
}

describe("execution replay protection", () => {
  it("rejects a duplicate execution claim", async () => {
    const store = await preparedStore();
    const key = "run-1:step-1";

    expect(await store.claimExecution(key, "run-1", "step-1", new Date(0).toISOString())).toBe(true);
    expect(await store.claimExecution(key, "run-1", "step-1", new Date(1).toISOString())).toBe(false);
  });

  it("allows only one winner across concurrent claims", async () => {
    const store = await preparedStore();
    const key = "run-1:step-1";

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.claimExecution(key, "run-1", "step-1", new Date(index).toISOString()),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((value) => !value)).toHaveLength(19);
  });
});

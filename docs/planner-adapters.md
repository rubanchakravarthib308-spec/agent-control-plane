# Planner adapters

The control plane deliberately treats planning and execution as separate authorities.

An LLM may propose a plan, but it cannot call tools directly. Every model response must pass through the provider-neutral `PlanningModelProvider` interface and then through structured plan validation before the control plane considers any step executable.

## Provider-neutral boundary

```ts
import { LLMPlannerAdapter, type PlanningModelProvider } from "../src/planner.js";

const provider: PlanningModelProvider = {
  async generate({ systemPrompt, userPrompt }) {
    // Call any model SDK here and return either:
    // 1. a JSON string, or
    // 2. a parsed object shaped like { steps: [...] }
    return { steps: [] };
  },
};

const planner = new LLMPlannerAdapter(provider, {
  availableTools: ["read-record", "send-message"],
  maxSteps: 10,
});
```

The adapter does not depend on OpenAI, Anthropic, Gemini, or any other vendor SDK. A provider-specific integration only needs to implement `generate()`.

## Required model response

The response must be strict JSON with one top-level field:

```json
{
  "steps": [
    {
      "id": "step-1",
      "action": "Read customer record",
      "tool": "read-record",
      "input": { "customerId": "c-1" },
      "risk": "low"
    }
  ]
}
```

Validation rejects malformed JSON, extra fields, empty plans, duplicate step IDs, invalid risk values, excessive step counts, and unavailable tools.

## Execution authority stays outside the model

A valid plan still has to pass through the rest of the control plane:

```text
Model proposal
  -> structured validation
  -> risk classification
  -> scoped human approval when required
  -> idempotent execution claim
  -> registered tool boundary
  -> post-action verification
  -> durable audit trail
```

This means switching model providers does not change the authorization model.

## Deterministic offline testing

Use `DeterministicPlanner` when tests or demos must not depend on a live model:

```ts
import { DeterministicPlanner } from "../src/planner.js";

const planner = new DeterministicPlanner(async () => [
  {
    id: "step-1",
    action: "Read record",
    tool: "read-record",
    input: {},
    risk: "low",
  },
]);
```

This keeps CI reproducible while exercising the same validated planner boundary used by an LLM adapter.

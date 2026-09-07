# Agent Control Plane

> **A production-minded execution layer for AI agents — plan, act, verify, approve.**

[![CI](https://github.com/rubanchakravarthib308-spec/agent-control-plane/actions/workflows/ci.yml/badge.svg)](https://github.com/rubanchakravarthib308-spec/agent-control-plane/actions/workflows/ci.yml)

Most AI-agent demos stop at “the model called a tool.” Real systems need more: **structured planning, risk classification, human approval, replay protection, deterministic execution boundaries, post-action verification, durable state, and an audit trail**.

This project is a compact reference implementation of that control layer.

## Why this exists

AI agents become useful when they can take action. They become trustworthy when every action is **bounded, reviewable, and verifiable**.

The control plane enforces this flow:

```text
Goal
  ↓
Planner / LLM proposal
  ↓
Structured plan validation
  ↓
Risk-aware plan
  ↓
Scoped, time-bound human approval for high-risk steps
  ↓
Idempotent execution claim
  ↓
Tool execution
  ↓
Post-action verification
  ↓
Durable audit trail + final status
```

## What makes this different

This is not a chatbot wrapper. The core engineering idea is separation of authority:

> **The planner proposes what should happen. The control plane decides what is allowed to happen.**

A model provider never receives direct execution authority. Model output is validated before it can reach approval, replay protection, tool execution, or verification.

## What it demonstrates

- Provider-neutral LLM planner interface
- Strict structured-plan validation
- Deterministic offline planner for tests and demos
- Tool registry and controlled execution
- Risk-aware human-in-the-loop approval
- Exact approval fingerprints, expiry, and capability scopes
- Idempotency and replay protection
- PostgreSQL-backed run, step, execution-claim, and audit persistence
- Post-action verification
- Explicit blocked / failed / completed states
- Audit events for every important decision
- Strict TypeScript domain modeling
- Automated tests for safety gates
- CI validation on pushes and pull requests

## Architecture

```text
LLM Provider / Deterministic Planner
              │
              ▼
      Structured Plan Validation
              │
              ▼
           PlanStep
              │
              ├── low / medium risk ─────────────┐
              │                                  │
              └── high risk → Scoped Approval   │
                                                 ▼
                                      Idempotency Claim
                                                 │
                                                 ▼
                                          Tool Registry
                                                 │
                                                 ▼
                                            Verification
                                                 │
                                                 ▼
                                      PostgreSQL / Audit Log
```

See the deeper design notes in [`docs/architecture.md`](docs/architecture.md) and the planner adapter guide in [`docs/planner-adapters.md`](docs/planner-adapters.md).

## Demo

The repository includes a deterministic local demo with no API key requirement.

Scenario:

1. Draft an outreach message — **low risk**
2. Send the outreach — **high risk**
3. Require an exact, expiring, capability-scoped human approval
4. Acquire an idempotent execution claim
5. Execute only if all gates pass
6. Verify the result
7. Record the audit trail

Run it locally:

```bash
npm install
npm run check
npm run demo
```

Read the walkthrough in [`docs/demo.md`](docs/demo.md).

## Planner adapters

`LLMPlannerAdapter` accepts any provider that implements a small `generate()` interface. The control plane itself is not coupled to a vendor SDK.

```ts
const planner = new LLMPlannerAdapter(provider, {
  availableTools: ["read-record", "send-message"],
  maxSteps: 10,
});
```

Malformed JSON, invalid schemas, duplicate step IDs, excessive plans, and unknown tools are rejected **before any tool can execute**.

For CI and local development, `DeterministicPlanner` uses the same validation boundary without requiring a live model.

## Project structure

```text
src/
  planner.ts              # provider-neutral planner + structured validation
  control-plane.ts        # orchestration, approvals, replay guard, verification
  approval-policy.ts      # exact action fingerprints, expiry, capability scopes
  run-store.ts            # persistence contract
  memory-run-store.ts     # deterministic in-memory store
  postgres-run-store.ts   # durable PostgreSQL store
  tool-registry.ts        # registered execution boundary
  types.ts                # domain model
  demo.ts                 # deterministic end-to-end example

migrations/
  001_run_store.sql
  002_execution_claims.sql

tests/
  control-plane.test.ts
  run-store.test.ts
  replay-protection.test.ts
  approval-policy.test.ts
  planner.test.ts

docs/
  architecture.md
  demo.md
  planner-adapters.md

.github/workflows/
  ci.yml
```

## Current maturity

**v0.2 — guarded agent execution foundation**

Implemented:

- Goal → validated plan → execute → verify lifecycle
- Provider-neutral LLM planner boundary
- Deterministic test planner
- Human approval gate for high-risk operations
- Exact approval fingerprints, expiry, and capability scopes
- Idempotency and replay protection
- PostgreSQL-backed run state and append-only audit history
- Guarded tool registry
- Post-action verification
- Safety-focused tests
- GitHub Actions CI

Next:

- Retry strategy for transient failures
- OpenTelemetry-style observability
- Real provider example package or optional integration
- Stronger PostgreSQL integration tests

## Engineering principle

> **Autonomy without control is a demo. Autonomy with boundaries, evidence, and verification can become a system.**

## About this project

Built by **Ruban Chakravarthi** as a public AI-engineering portfolio project focused on **Agentic AI, safe tool use, human oversight, and production-oriented orchestration**.

This repository is intentionally small enough to understand quickly, but designed around patterns that scale into larger agent systems.

## Open to collaboration

If you're hiring for **AI engineering, agentic systems, LLM applications, workflow automation, or production AI infrastructure**, this project is representative of how I think about building reliable systems around intelligent models.

# Agent Control Plane

> **A production-minded execution layer for AI agents — plan, act, verify, approve.**

[![CI](https://github.com/rubanchakravarthib308-spec/agent-control-plane/actions/workflows/ci.yml/badge.svg)](https://github.com/rubanchakravarthib308-spec/agent-control-plane/actions/workflows/ci.yml)

Most AI-agent demos stop at “the model called a tool.” Real systems need more: **risk classification, human approval, deterministic execution boundaries, post-action verification, and an audit trail**.

This project is a compact reference implementation of that control layer.

## Why this exists

AI agents become useful when they can take action. They become trustworthy when every action is **bounded, reviewable, and verifiable**.

The control plane enforces this flow:

```text
Goal
  ↓
Planner
  ↓
Risk-aware plan
  ↓
Human approval for high-risk steps
  ↓
Tool execution
  ↓
Post-action verification
  ↓
Audit trail + final status
```

## What makes this different

This is not a chatbot wrapper. The core engineering idea is separation of authority:

> **The planner proposes what should happen. The control plane decides what is allowed to happen.**

That distinction creates a safer foundation for agents that interact with real systems.

## What it demonstrates

- Agent planning boundaries
- Tool registry and controlled execution
- Risk-aware human-in-the-loop approval
- Post-action verification
- Explicit blocked / failed / completed states
- Audit events for every important decision
- Strict TypeScript domain modeling
- Automated tests for safety gates
- CI validation on pushes and pull requests

## Architecture

```text
Planner / LLM
     │
     ▼
  PlanStep
     │
     ├── low / medium risk ───────┐
     │                            │
     └── high risk → Human Review│
                                  ▼
                           Tool Registry
                                  │
                                  ▼
                             Verification
                                  │
                                  ▼
                              Audit Log
```

See the deeper design notes in [`docs/architecture.md`](docs/architecture.md).

## Demo

The repository includes a deterministic local demo with no API key requirement.

Scenario:

1. Draft an outreach message — **low risk**
2. Send the outreach — **high risk**
3. Pause for human approval
4. Execute only if approved
5. Verify the result
6. Record the audit trail

Run it locally:

```bash
npm install
npm run check
npm run demo
```

Read the full walkthrough in [`docs/demo.md`](docs/demo.md).

## Example safety behavior

A low-risk read can execute immediately.

A high-risk action such as sending a message must be approved first. If the reviewer denies it, the run stops as `blocked` and the tool is never executed.

If execution succeeds but verification fails, the run ends as `failed` rather than pretending success.

## Project structure

```text
src/
  control-plane.ts   # orchestration, approvals, verification, audit
  tool-registry.ts   # registered execution boundary
  types.ts           # domain model
  demo.ts            # deterministic end-to-end example

tests/
  control-plane.test.ts

docs/
  architecture.md
  demo.md

.github/workflows/
  ci.yml
```

## Current maturity

**v0.1 — control-plane foundation**

Implemented:

- Goal → plan → execute → verify lifecycle
- Human approval gate for high-risk operations
- Guarded tool registry
- Structured audit trail
- Safety-focused tests
- GitHub Actions CI

Next:

- Durable run state
- PostgreSQL-backed audit store
- Idempotency and replay protection
- Time-bound approvals
- Tool policies and capability scopes
- Retry strategy for transient failures
- OpenTelemetry-style observability
- Pluggable LLM planner adapter

## Engineering principle

> **Autonomy without control is a demo. Autonomy with boundaries, evidence, and verification can become a system.**

## About this project

Built by **Ruban Chakravarthi** as a public AI-engineering portfolio project focused on **Agentic AI, safe tool use, human oversight, and production-oriented orchestration**.

This repository is intentionally small enough to understand quickly, but designed around patterns that scale into larger agent systems.

## Open to collaboration

If you're hiring for **AI engineering, agentic systems, LLM applications, workflow automation, or production AI infrastructure**, this project is representative of how I think about building reliable systems around intelligent models.

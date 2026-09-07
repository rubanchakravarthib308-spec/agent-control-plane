# Agent Control Plane

> **A production-minded execution layer for AI agents — plan, act, verify, approve.**

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

## Core idea

The LLM or planner proposes **what should happen**. The control plane decides **what is allowed to happen**.

That separation is deliberate.

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

.github/workflows/
  ci.yml
```

## Run locally

Requirements: Node.js 22+

```bash
npm install
npm run check
npm run demo
```

The demo intentionally uses deterministic local tools — no API key is required.

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

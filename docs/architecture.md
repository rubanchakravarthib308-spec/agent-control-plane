# Architecture

## Design goal

Keep model intelligence separate from execution authority.

The planner may propose an action, but only the control plane can decide whether that action is permitted to execute.

```text
┌──────────────┐
│ User / Goal  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Planner / LLM│
└──────┬───────┘
       │ proposed steps
       ▼
┌───────────────────────────┐
│ Agent Control Plane       │
│                           │
│  1. classify risk         │
│  2. require approval      │
│  3. select registered tool│
│  4. execute               │
│  5. verify result         │
│  6. append audit event    │
└───────────┬───────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌──────────┐  ┌──────────────┐
│ Human    │  │ Tool Registry│
│ Approval │  │ + Adapters   │
└──────────┘  └──────┬───────┘
                     │
                     ▼
               ┌────────────┐
               │ Real action│
               └──────┬─────┘
                      │
                      ▼
               ┌────────────┐
               │ Verifier   │
               └──────┬─────┘
                      │
                      ▼
               ┌────────────┐
               │ Audit trail│
               └────────────┘
```

## Core components

### Planner boundary
The planner produces structured steps. It does not execute tools directly.

### Risk gate
Each proposed step carries a risk level. High-risk work must be explicitly approved before execution.

### Tool registry
Only registered tools can run. This creates a capability boundary between the planner and the outside world.

### Verification
Execution success is not treated as sufficient evidence. A verifier checks the result before the control plane marks the step complete.

### Audit trail
Important state transitions are captured as structured events so a run can be inspected after the fact.

## Production roadmap

The current implementation is intentionally compact. A production deployment would add durable state, identity, policy scopes, cryptographic approval binding, idempotency, retries, secrets isolation, telemetry, and model/provider adapters without weakening the planner/executor separation.

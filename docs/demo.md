# Demo walkthrough

This repository includes a deterministic local demo so the control-flow can be inspected without API keys or external services.

## Scenario

The agent receives the goal:

> Prepare and send a reviewed outreach message.

The planner proposes two steps:

1. Draft the outreach — **low risk**
2. Send the outreach — **high risk**

The control plane allows the low-risk draft to run immediately. Before the high-risk send step, execution pauses for human approval. Only an approved step reaches the registered tool. After every tool call, verification decides whether the step can be considered successful.

## Run it

```bash
npm install
npm run check
npm run demo
```

## What to inspect

The final JSON result shows the run status and audit events. The important behavior is not the message itself — it is the control boundary around the action:

```text
Goal received
  ↓
Plan created
  ↓
Low-risk draft executes
  ↓
Verification passes
  ↓
High-risk send requires approval
  ↓
Human approves
  ↓
Send tool executes
  ↓
Verification passes
  ↓
Run completes with audit evidence
```

## Why this demo is deterministic

Portfolio agent projects often hide the orchestration behind an API call to an LLM. This demo deliberately keeps the planner and tools local so reviewers can test the **control-plane behavior itself** without needing credentials, paid APIs, or network access.

A pluggable LLM planner is a later milestone; the safety boundary should remain testable independently from whichever model proposes actions.

create table if not exists agent_execution_claims (
  idempotency_key text primary key,
  run_id text not null references agent_runs(id) on delete cascade,
  step_id text not null,
  claimed_at timestamptz not null,
  unique (run_id, step_id)
);

create index if not exists idx_agent_execution_claims_run_step
  on agent_execution_claims(run_id, step_id);

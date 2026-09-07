create table if not exists agent_runs (
  id text primary key,
  goal_id text not null,
  objective text not null,
  status text not null check (status in ('running', 'completed', 'blocked', 'failed')),
  created_at timestamptz not null,
  finished_at timestamptz
);

create table if not exists agent_run_steps (
  run_id text not null references agent_runs(id) on delete cascade,
  step_id text not null,
  step_order integer not null,
  action text not null,
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  risk text not null check (risk in ('low', 'medium', 'high')),
  status text not null,
  approval jsonb,
  output jsonb,
  verification jsonb,
  primary key (run_id, step_id),
  unique (run_id, step_order)
);

create table if not exists agent_audit_events (
  id bigserial primary key,
  run_id text not null references agent_runs(id) on delete cascade,
  occurred_at timestamptz not null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_agent_audit_events_run_id_id
  on agent_audit_events(run_id, id);

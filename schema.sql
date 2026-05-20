-- ARGEYE — Supabase schema
-- Run in the Supabase SQL editor.

create table if not exists argeye_trials (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text,
  input       text,
  claim       text,
  domain      text,
  conviction  int,
  verdict     text,
  payload     jsonb,
  source_url  text,
  created_at  timestamptz default now()
);

create index if not exists argeye_trials_created_idx on argeye_trials (created_at desc);
create index if not exists argeye_trials_domain_idx  on argeye_trials (domain);

-- Service role (backend) bypasses RLS, so RLS stays on for safety:
alter table argeye_trials enable row level security;

-- Allow anonymous reads of the Pulse feed (claims only — payload stays private via the API layer).
create policy "public read pulse"
  on argeye_trials for select
  using (true);

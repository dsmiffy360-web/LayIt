-- FloorCraft — Supabase schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- after creating a project. Mirrors the job data model already proven out
-- in the artifact prototype, so migrating existing local jobs is a
-- straight JSON copy into `data`, not a reshape.

-- Business profile: one per user, shared across all their jobs (matches
-- the artifact's "saved once, reused everywhere" business-profile design).
create table business_profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  name text default '',
  contact text default '',
  bank_details text default '',
  updated_at timestamptz default now()
);

-- Jobs: one row per job. `data` holds everything the artifact currently
-- keeps in React state for a job (sections, alcoves, material, pattern,
-- invoice fields, etc.) as JSONB — same shape as the localStorage blob,
-- so the client code barely changes to read/write it.
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'New job',
  client text default '',
  status text default 'quote' check (status in ('quote', 'in-progress', 'complete')),
  archived boolean default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index jobs_user_id_idx on jobs(user_id);
create index jobs_updated_at_idx on jobs(user_id, updated_at desc);

-- Subscription status, updated by the Stripe webhook — see
-- /api/stripe-webhook. Kept separate from auth.users since Supabase
-- manages that table; this is the join point for feature-gating.
create table subscriptions (
  user_id uuid references auth.users(id) on delete cascade primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'free' check (status in ('free', 'active', 'past_due', 'canceled')),
  plan text default 'free' check (plan in ('free', 'contractor')),
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

-- Row Level Security: every table is scoped to auth.uid() so one user's
-- Supabase client can only ever see their own rows, enforced at the
-- database layer regardless of what the client code does.
alter table business_profiles enable row level security;
alter table jobs enable row level security;
alter table subscriptions enable row level security;

create policy "own business profile" on business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own jobs" on jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own subscription read" on subscriptions
  for select using (auth.uid() = user_id);
-- No insert/update policy for subscriptions on purpose — only the
-- webhook (using the service role key, which bypasses RLS) should write
-- subscription status. A user's own client should never be able to grant
-- itself "active".

-- Keep updated_at current on every write, so "sort by most recent" (the
-- job switcher's default order) works without extra client logic.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_updated_at before update on jobs
  for each row execute function set_updated_at();

create trigger business_profiles_updated_at before update on business_profiles
  for each row execute function set_updated_at();

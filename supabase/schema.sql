-- LayIt — Supabase schema
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
  logo text default null, -- data URI, resized client-side before saving — Contractor-only (invoicing is gated to that plan already)
  updated_at timestamptz default now()
);

-- Clients: a small saved address book so a repeat client doesn't need
-- their name/address retyped on every job — also the join point for
-- "past jobs for this client" on the Invoice step.
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  address text default '',
  contact text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index clients_user_id_idx on clients(user_id);

-- Jobs: one row per job. `data` holds everything the artifact currently
-- keeps in React state for a job (sections, alcoves, material, pattern,
-- invoice fields, etc.) as JSONB — same shape as the localStorage blob,
-- so the client code barely changes to read/write it.
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'New job',
  client text default '',
  client_id uuid references clients(id) on delete set null,
  status text default 'quote' check (status in ('quote', 'in-progress', 'complete')),
  archived boolean default false,
  scheduled_date date default null, -- planned install/start date, shown in the job-list "Upcoming" section
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index jobs_user_id_idx on jobs(user_id);
create index jobs_updated_at_idx on jobs(user_id, updated_at desc);
create index jobs_client_id_idx on jobs(client_id);
create index jobs_scheduled_date_idx on jobs(user_id, scheduled_date);

-- Saved materials: a small reusable price book so a contractor who mostly
-- installs the same handful of products doesn't retype length/width/pack
-- size/price on every new job's Material step. One row per saved product.
create table saved_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  material_type text not null default 'plank' check (material_type in ('plank', 'tile', 'roll')),
  length text default '',
  width text default '',
  pack_size text default '',
  price_per_pack text default '',
  roll_width text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index saved_materials_user_id_idx on saved_materials(user_id);

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

-- Push subscriptions: one row per browser/device a user has enabled job
-- reminders on (a phone and a laptop each get their own row). Written by
-- the client when the user opts in via pushNotifications.js, read by
-- /api/send-reminders (service role, bypasses RLS) to deliver the
-- same-day "job scheduled today" nudge.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- Row Level Security: every table is scoped to auth.uid() so one user's
-- Supabase client can only ever see their own rows, enforced at the
-- database layer regardless of what the client code does.
alter table business_profiles enable row level security;
alter table jobs enable row level security;
alter table subscriptions enable row level security;
alter table saved_materials enable row level security;
alter table push_subscriptions enable row level security;
alter table clients enable row level security;

create policy "own business profile" on business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own jobs" on jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own saved materials" on saved_materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own clients" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own push subscriptions" on push_subscriptions
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

create trigger saved_materials_updated_at before update on saved_materials
  for each row execute function set_updated_at();

create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- Job attachments: private Storage bucket for room photos and material
-- receipts (see src/lib/attachments.js), one bucket shared by all users
-- since RLS on the path itself does the isolation. Path convention is
-- {user_id}/{job_id}/{file} — every policy below keys off the first path
-- segment matching the requesting user, same "own rows only" model as
-- every table above, just expressed for storage.objects instead of a
-- table. Created via the Storage UI in this project (a bucket insert via
-- plain SQL is equivalent if setting this up elsewhere):
--
-- insert into storage.buckets (id, name, public) values ('job-attachments', 'job-attachments', false);
--
-- create policy "own job attachments" on storage.objects for all
--   using (bucket_id = 'job-attachments' and (storage.foldername(name))[1] = (select auth.uid()::text))
--   with check (bucket_id = 'job-attachments' and (storage.foldername(name))[1] = (select auth.uid()::text));

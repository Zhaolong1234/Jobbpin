create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  name text,
  target_role text,
  years_exp text,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  parsed_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_resumes_user_id_created_at
  on resumes (user_id, created_at desc);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'incomplete',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_updated_at on subscriptions;
create trigger trg_subscriptions_updated_at
before update on subscriptions
for each row
execute function update_updated_at_column();

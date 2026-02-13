create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  name text,
  first_name text,
  last_name text,
  target_role text,
  years_exp text,
  country text,
  city text,
  linkedin_url text,
  portfolio_url text,
  allow_linkedin_analysis boolean not null default false,
  employment_types jsonb not null default '[]'::jsonb,
  profile_skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists country text;
alter table profiles add column if not exists linkedin_url text;
alter table profiles add column if not exists portfolio_url text;
alter table profiles add column if not exists allow_linkedin_analysis boolean not null default false;
alter table profiles add column if not exists employment_types jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists profile_skipped boolean not null default false;
alter table profiles add column if not exists updated_at timestamptz not null default now();

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

create table if not exists onboarding_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  current_step int not null default 1,
  is_completed boolean not null default false,
  profile_skipped boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table onboarding_states add column if not exists profile_skipped boolean not null default false;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  onboarding_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists email text;
alter table users add column if not exists onboarding_completed_at timestamptz not null default now();
alter table users add column if not exists updated_at timestamptz not null default now();

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

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
before update on profiles
for each row
execute function update_updated_at_column();

drop trigger if exists trg_onboarding_states_updated_at on onboarding_states;
create trigger trg_onboarding_states_updated_at
before update on onboarding_states
for each row
execute function update_updated_at_column();

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row
execute function update_updated_at_column();

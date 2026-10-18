
-- Hisaab Saaf: Initial database schema

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 40),
  phone text not null unique
    check (phone ~ '^[6-9][0-9]{9}$'),
  consented_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.engagements (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null
    references public.profiles(id) on delete cascade,
  label text not null
    check (char_length(label) between 1 and 40),
  employer_phone text not null
    check (employer_phone ~ '^[6-9][0-9]{9}$'),
  paid_leave_per_month smallint not null default 4
    check (paid_leave_per_month between 0 and 10),
  weekly_off smallint
    check (weekly_off between 0 and 6),
  start_date date not null default current_date
    check (start_date <= current_date),
  employer_bound_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index engagements_worker_active_idx
  on public.engagements(worker_id) where active;

create type public.entry_type as enum (
  'leave', 'advance', 'payment', 'bonus'
);

create type public.entry_status as enum (
  'pending', 'confirmed', 'contested'
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null
    references public.engagements(id) on delete cascade,
  type public.entry_type not null,
  entry_date date not null,
  amount integer check (amount between 1 and 50000),
  note text check (char_length(note) <= 80),
  status public.entry_status not null default 'pending',
  responded_at timestamptz,
  created_by text not null default 'worker'
    check (created_by = 'worker'),
  created_at timestamptz not null default now(),

  constraint leave_unique_per_day
    unique (engagement_id, type, entry_date),

  constraint amount_required check (
    (type = 'leave' and amount is null)
    or
    (type <> 'leave' and amount is not null)
  )
);

create index entries_engagement_date_idx
  on public.entries(engagement_id, entry_date desc);

create type public.token_purpose as enum ('entry', 'summary');

create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  purpose public.token_purpose not null,
  entry_id uuid references public.entries(id) on delete cascade,
  engagement_id uuid not null
    references public.engagements(id) on delete cascade,
  month date,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.events (
  id bigserial primary key,
  user_id uuid,
  engagement_id uuid,
  name text not null check (name in (
    'login', 'entry_created', 'link_issued', 'link_opened',
    'entry_confirmed', 'entry_contested', 'summary_viewed',
    'authz_denied', 'account_deleted'
  )),
  created_at timestamptz not null default now()
);

create index events_name_created_idx
  on public.events(name, created_at);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.engagements enable row level security;
alter table public.entries enable row level security;
alter table public.tokens enable row level security;
alter table public.events enable row level security;

-- Profiles: users can access only their own profile
create policy "own profile"
on public.profiles for all
using (id = auth.uid())
with check (id = auth.uid());

-- Engagements: users can manage only their own households
create policy "own engagements"
on public.engagements for all
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

-- Entries: users can read their own household entries
create policy "own entries"
on public.entries for select
using (
  exists (
    select 1 from public.engagements e
    where e.id = engagement_id
      and e.worker_id = auth.uid()
  )
);

create policy "insert own entries"
on public.entries for insert
with check (
  exists (
    select 1 from public.engagements e
    where e.id = engagement_id
      and e.worker_id = auth.uid()
  )
);

create policy "delete own pending"
on public.entries for delete
using (
  status = 'pending'
  and exists (
    select 1 from public.engagements e
    where e.id = engagement_id
      and e.worker_id = auth.uid()
  )
);

-- Event logging
create policy "insert own events"
on public.events for insert
with check (user_id = auth.uid());

-- No client-facing policies for tokens.
-- Trusted server-side code will manage confirmation tokens.

-- Monthly summary
create view public.month_summary
with (security_invoker = true) as
select
  e.engagement_id,
  date_trunc('month', e.entry_date)::date as month,
  count(*) filter (
    where e.type = 'leave'
      and e.status in ('pending', 'confirmed')
  ) as leave_used,
  count(*) filter (
    where e.type = 'leave'
      and e.status = 'contested'
  ) as leave_contested,
  coalesce(sum(e.amount) filter (
    where e.type = 'advance'
      and e.status = 'confirmed'
  ), 0) as advance_confirmed,
  coalesce(sum(e.amount) filter (
    where e.type = 'advance'
      and e.status = 'pending'
  ), 0) as advance_pending,
  coalesce(sum(e.amount) filter (
    where e.type = 'advance'
      and e.status = 'contested'
  ), 0) as advance_contested
from public.entries e
group by e.engagement_id, date_trunc('month', e.entry_date)::date;

-- Kliento early access signups
create table if not exists public.early_access (
  id uuid primary key default gen_random_uuid(),
  name text,
  business_name text,
  business_type text,
  phone text,
  email text not null,
  city_state text,
  is_waitlist boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.early_access enable row level security;

-- Public can insert signups, but cannot read any rows back.
create policy "Public can insert early access signups"
  on public.early_access
  for insert
  to anon
  with check (true);

-- Count of non-waitlist signups, exposed without granting table SELECT.
create or replace function public.get_early_access_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.early_access where is_waitlist = false;
$$;

grant execute on function public.get_early_access_count() to anon, authenticated;

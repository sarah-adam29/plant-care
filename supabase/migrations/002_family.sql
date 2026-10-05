-- 002_family.sql — make Plant Care ready for friends & family (Phase 5, step 1).
-- Run ONCE in the Supabase SQL editor, after schema.sql. Safe to read top to bottom:
--
--   1. Each home gets a location, time zone and units (°C/cm or °F/ft).
--   2. Sign-ups are approved-only: you (the app admin) keep a list of emails
--      allowed to start a new home. People invited into an existing home don't
--      need to be on it — the invite is enough.
--   3. A daily cap on AI actions per home (identify / update advice), so nobody
--      can run up your Anthropic bill by accident.
--
-- 📘 LEARN: "security definer" functions run with the database owner's rights
-- but only do the narrow thing written inside them — the same pattern as
-- create_household in schema.sql.

-- ── 1. Location per home ────────────────────────────────────────────────────
alter table public.households
  add column if not exists location text,                               -- "Cape Town, South Africa"
  add column if not exists timezone text,                               -- "Africa/Johannesburg"
  add column if not exists units text not null default 'metric' check (units in ('metric', 'imperial'));

-- Your existing home was created before locations existed.
update public.households set location = 'Dubai, United Arab Emirates', timezone = 'Asia/Dubai' where location is null;

-- ── 2. Approved sign-ups ────────────────────────────────────────────────────
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  note text,                                                            -- "Mum, DC"
  added_by uuid references auth.users on delete set null,
  added_at timestamptz not null default now()
);

create or replace function public.is_app_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;

-- Asked by the login page BEFORE sending a code: is this email welcome here?
-- Yes if they already have an account, are on the approved list, or were invited.
create or replace function public.email_allowed(e text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(e)))
      or exists (select 1 from public.allowed_emails where email = lower(trim(e)))
      or exists (select 1 from public.household_invites where email = lower(trim(e)))
$$;

-- Starting a NEW home now needs approval (joining via an invite still doesn't).
-- Also records the home's location, time zone and units.
drop function if exists public.create_household(text, text);
create or replace function public.create_household(
  home_name text, my_name text,
  home_location text default null, home_timezone text default null, home_units text default 'metric'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; my_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select lower(email) into my_email from auth.users where id = auth.uid();
  if not (public.is_app_admin() or exists (select 1 from public.allowed_emails where email = my_email)) then
    raise exception 'NOT_APPROVED';
  end if;
  insert into public.households (name, created_by, location, timezone, units)
    values (home_name, auth.uid(), nullif(trim(home_location), ''), nullif(trim(home_timezone), ''),
            case when home_units = 'imperial' then 'imperial' else 'metric' end)
    returning id into h;
  insert into public.household_members (household_id, user_id, display_name, role) values (h, auth.uid(), my_name, 'owner');
  insert into public.household_settings (household_id) values (h);
  return h;
end $$;

-- ── 3. Daily AI cap per home ────────────────────────────────────────────────
create table if not exists public.ai_usage (
  household_id uuid not null references public.households on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (household_id, day)
);

-- Counts one AI action for a home; returns false once today's limit is reached.
-- The limit lives here (not in the app) so it can't be changed from a browser.
create or replace function public.use_ai(h uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int; daily_limit constant int := 30;
begin
  if not public.is_member(h) then raise exception 'Not a member of this home'; end if;
  insert into public.ai_usage (household_id, day, count) values (h, current_date, 1)
    on conflict (household_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < daily_limit
    returning count into n;
  return n is not null;
end $$;

-- ── Who may call / see what ─────────────────────────────────────────────────
revoke all on function public.create_household(text, text, text, text, text) from public, anon;
grant execute on function public.create_household(text, text, text, text, text) to authenticated;
revoke all on function public.use_ai(uuid) from public, anon;
grant execute on function public.use_ai(uuid) to authenticated;
revoke all on function public.email_allowed(text) from public;
grant execute on function public.email_allowed(text) to anon, authenticated;
grant execute on function public.is_app_admin() to authenticated;

grant select, insert, update, delete on public.app_admins, public.allowed_emails, public.ai_usage to authenticated;
revoke all on public.app_admins, public.allowed_emails, public.ai_usage from anon;

alter table public.app_admins enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "see if you are admin" on public.app_admins;
create policy "see if you are admin" on public.app_admins for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins manage the approved list" on public.allowed_emails;
create policy "admins manage the approved list" on public.allowed_emails for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "members see their usage" on public.ai_usage;
create policy "members see their usage" on public.ai_usage for select to authenticated using (public.is_member(household_id));

-- ── Make YOU the app admin ──────────────────────────────────────────────────
-- ✏️ Put the email YOU sign in to Plant Care with here (sign in once first).
insert into public.app_admins (user_id)
  select id from auth.users where lower(email) = 'you@example.com'
  on conflict do nothing;

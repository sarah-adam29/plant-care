-- schema.sql — Plant Care database (Supabase / Postgres). Run once in the
-- Supabase SQL editor on a fresh project.
--
-- 📘 LEARN: Same shapes as src/lib/types.ts, as tables. Row Level Security
-- (RLS) means the DATABASE itself refuses to show a plant to anyone who isn't
-- a member of that plant's household — even if the app had a bug. That's what
-- makes it safe to put online and to let friends have their own homes later.

-- ── Tables ───────────────────────────────────────────────────────────────────

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                  -- "Dubai apartment"
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null,                          -- shown in "Watered by …"
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  email text not null check (email = lower(email)),
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

create table public.household_settings (
  household_id uuid primary key references public.households on delete cascade,
  equipment text[] not null default '{}'
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  nickname text not null,
  common_name text not null,
  botanical_name text not null,
  id_confidence text not null check (id_confidence in ('high', 'medium', 'low')),
  description text not null default '',
  owner text not null,
  caretaker text not null,
  photo_url text,                                      -- /api/photos/sb/<household>/<file> or /seed/…
  ideal jsonb not null,                                -- IdealEnvironment
  current jsonb not null,                              -- CurrentEnvironment
  moisture_water_at int check (moisture_water_at between 1 and 10),
  created_at timestamptz not null default now()
);
create index plants_household_idx on public.plants (household_id);

create table public.plant_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  occurred_at date not null,
  approximate boolean not null default false,
  type text not null,                                  -- watered | moved | moisture-reading | …
  actor text not null,                                 -- who did it
  note text not null default '',
  photo_url text,
  reading int check (reading between 1 and 10),        -- moisture-meter reading
  logged_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index plant_events_plant_idx on public.plant_events (plant_id);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  status text not null,
  body jsonb not null                                  -- the full Assessment object
);
create index assessments_plant_idx on public.assessments (plant_id);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  due_on date not null,
  task text not null,
  done_at timestamptz
);
create index checks_plant_idx on public.checks (plant_id);

-- ── Helper functions (run with elevated rights, but only answer yes/no) ─────

create function public.is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.household_members m where m.household_id = h and m.user_id = auth.uid())
$$;

create function public.plant_household(p uuid) returns uuid
language sql security definer stable set search_path = public as $$
  select household_id from public.plants where id = p
$$;

-- Photos are stored at plant-photos/<household id>/<file>; this checks the folder safely.
create function public.is_member_folder(object_name text) returns boolean
language sql security definer stable set search_path = public as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f-]{36}$'
      then public.is_member(split_part(object_name, '/', 1)::uuid)
    else false
  end
$$;

-- ── Actions people can take (checked inside, so they can't be misused) ─────

-- First sign-in: create your home and become its owner.
create function public.create_household(home_name text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.households (name, created_by) values (home_name, auth.uid()) returning id into h;
  insert into public.household_members (household_id, user_id, display_name, role) values (h, auth.uid(), my_name, 'owner');
  insert into public.household_settings (household_id) values (h);
  return h;
end $$;

-- Signing in with an invited email joins that home automatically.
create function public.accept_invites(my_name text) returns int
language plpgsql security definer set search_path = public as $$
declare my_email text; n int := 0; inv record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select lower(email) into my_email from auth.users where id = auth.uid();
  for inv in select * from public.household_invites where email = my_email loop
    insert into public.household_members (household_id, user_id, display_name, role)
      values (inv.household_id, auth.uid(), my_name, 'member') on conflict do nothing;
    delete from public.household_invites where id = inv.id;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.accept_invites(text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.accept_invites(text) to authenticated;

-- ── Who may use the tables at all (RLS below then decides WHICH rows) ──────
-- Signed-in people only; visitors who aren't signed in ("anon") get nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.household_settings enable row level security;
alter table public.plants enable row level security;
alter table public.plant_events enable row level security;
alter table public.assessments enable row level security;
alter table public.checks enable row level security;

create policy "members read their home" on public.households for select to authenticated using (public.is_member(id));
create policy "members rename their home" on public.households for update to authenticated using (public.is_member(id));

create policy "members see co-members" on public.household_members for select to authenticated using (public.is_member(household_id));
create policy "members update own name" on public.household_members for update to authenticated using (user_id = auth.uid());

create policy "members manage invites" on public.household_invites for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy "members manage settings" on public.household_settings for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy "members manage plants" on public.plants for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy "members manage events" on public.plant_events for all to authenticated
  using (public.is_member(public.plant_household(plant_id))) with check (public.is_member(public.plant_household(plant_id)));

create policy "members manage assessments" on public.assessments for all to authenticated
  using (public.is_member(public.plant_household(plant_id))) with check (public.is_member(public.plant_household(plant_id)));

create policy "members manage checks" on public.checks for all to authenticated
  using (public.is_member(public.plant_household(plant_id))) with check (public.is_member(public.plant_household(plant_id)));

-- ── Photo storage rules (bucket "plant-photos", private) ───────────────────

create policy "members read photos" on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos' and public.is_member_folder(name));
create policy "members add photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos' and public.is_member_folder(name));
create policy "members delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos' and public.is_member_folder(name));

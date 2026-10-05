-- 003_chat.sql — "Ask about <plant>" (Phase 5, step 2). Run ONCE in the
-- Supabase SQL editor, after 002_family.sql.
--
-- 📘 LEARN: Each question and Claude's short answer is kept on the plant, so
-- you (and others in your home) can scroll back. Nothing here becomes part of
-- the plant's history automatically — "Save to timeline" copies a Q&A into the
-- timeline only when someone taps it.

create table if not exists public.plant_questions (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants on delete cascade,
  asked_by uuid default auth.uid() references auth.users on delete set null,
  asker_name text not null,                       -- "Sarah"
  question text not null check (length(question) <= 1000),
  answer text not null default '',
  photo_url text,                                 -- optional close-up sent with the question
  added_to_timeline boolean not null default false,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists plant_questions_plant_idx on public.plant_questions (plant_id, created_at desc);

grant select, insert, update, delete on public.plant_questions to authenticated;
revoke all on public.plant_questions from anon;
alter table public.plant_questions enable row level security;

drop policy if exists "members manage questions" on public.plant_questions;
create policy "members manage questions" on public.plant_questions for all to authenticated
  using (public.is_member(public.plant_household(plant_id)))
  with check (public.is_member(public.plant_household(plant_id)));

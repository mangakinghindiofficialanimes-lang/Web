-- NITIN ANIMES starter schema
-- Run this in Supabase SQL Editor after creating your project.
-- Do not disable RLS or place service_role keys in browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('viewer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.anime (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  synopsis text not null default '',
  genre text not null default 'Adventure',
  release_year integer,
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.anime(id) on delete cascade,
  title text not null,
  episode_number integer not null default 1,
  video_url text,
  download_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (anime_id, episode_number)
);

create table if not exists public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anime_id uuid references public.anime(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  event_type text not null check (event_type in ('view', 'play', 'download')),
  created_at timestamptz not null default now()
);

create index if not exists anime_status_idx on public.anime(status);
create index if not exists episodes_anime_idx on public.episodes(anime_id);
create index if not exists watch_events_created_idx on public.watch_events(created_at desc);

-- Automatically create a viewer profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- A narrowly scoped helper avoids recursive RLS policy checks on profiles.
create or replace function public.is_nitin_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.anime enable row level security;
alter table public.episodes enable row level security;
alter table public.watch_events enable row level security;

drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_nitin_admin());

drop policy if exists "Admin updates profiles" on public.profiles;
create policy "Admin updates profiles" on public.profiles
for update to authenticated
using (public.is_nitin_admin())
with check (public.is_nitin_admin());

drop policy if exists "Public reads published anime" on public.anime;
create policy "Public reads published anime" on public.anime
for select to anon, authenticated
using (status = 'published' or public.is_nitin_admin());

drop policy if exists "Admin manages anime" on public.anime;
create policy "Admin manages anime" on public.anime
for all to authenticated
using (public.is_nitin_admin())
with check (public.is_nitin_admin());

drop policy if exists "Public reads published episodes" on public.episodes;
create policy "Public reads published episodes" on public.episodes
for select to anon, authenticated
using (is_published and exists (
  select 1 from public.anime a where a.id = anime_id and a.status = 'published'
) or public.is_nitin_admin());

drop policy if exists "Admin manages episodes" on public.episodes;
create policy "Admin manages episodes" on public.episodes
for all to authenticated
using (public.is_nitin_admin())
with check (public.is_nitin_admin());

drop policy if exists "Users submit own watch events" on public.watch_events;
create policy "Users submit own watch events" on public.watch_events
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Admin reads analytics events" on public.watch_events;
create policy "Admin reads analytics events" on public.watch_events
for select to authenticated
using (public.is_nitin_admin());

-- FIRST ADMIN SETUP:
-- 1. Sign up your own account through Supabase Auth.
-- 2. Find that user's UUID in Authentication > Users.
-- 3. In SQL Editor, run the following with your own UUID and email:
-- update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
-- Never expose your database password or service-role key.

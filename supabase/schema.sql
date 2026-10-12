-- NITIN ANIMES production-oriented starter schema.
-- Run once in Supabase SQL Editor. Review policies before storing real user data.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('viewer','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.anime (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  synopsis text not null default '',
  genre text not null default 'Adventure',
  release_year integer check (release_year is null or release_year between 1900 and 2200),
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.anime(id) on delete cascade,
  title text not null,
  episode_number integer not null default 1 check (episode_number > 0),
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
  event_type text not null check (event_type in ('view','play','download')),
  created_at timestamptz not null default now()
);
create index if not exists anime_status_idx on public.anime(status);
create index if not exists episodes_anime_idx on public.episodes(anime_id);
create index if not exists watch_events_created_idx on public.watch_events(created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id,email,role) values (new.id,new.email,'viewer')
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_nitin_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.anime enable row level security;
alter table public.episodes enable row level security;
alter table public.watch_events enable row level security;

drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles for select to authenticated
using (id=(select auth.uid()) or public.is_nitin_admin());
drop policy if exists "Admin updates profiles" on public.profiles;
create policy "Admin updates profiles" on public.profiles for update to authenticated
using (public.is_nitin_admin()) with check (public.is_nitin_admin());

drop policy if exists "Public reads published anime" on public.anime;
create policy "Public reads published anime" on public.anime for select to anon,authenticated
using (status='published' or public.is_nitin_admin());
drop policy if exists "Admin manages anime" on public.anime;
create policy "Admin manages anime" on public.anime for all to authenticated
using (public.is_nitin_admin()) with check (public.is_nitin_admin());

drop policy if exists "Public reads published episodes" on public.episodes;
create policy "Public reads published episodes" on public.episodes for select to anon,authenticated
using ((is_published and exists(select 1 from public.anime a where a.id=anime_id and a.status='published')) or public.is_nitin_admin());
drop policy if exists "Admin manages episodes" on public.episodes;
create policy "Admin manages episodes" on public.episodes for all to authenticated
using (public.is_nitin_admin()) with check (public.is_nitin_admin());

drop policy if exists "Users submit own watch events" on public.watch_events;
create policy "Users submit own watch events" on public.watch_events for insert to anon,authenticated
with check (user_id is null or user_id=(select auth.uid()));
drop policy if exists "Admin reads analytics events" on public.watch_events;
create policy "Admin reads analytics events" on public.watch_events for select to authenticated
using (public.is_nitin_admin());

grant select on public.anime,public.episodes to anon,authenticated;
grant select,insert,update,delete on public.anime,public.episodes to authenticated;
grant select,insert on public.watch_events to anon,authenticated;
grant select,update on public.profiles to authenticated;

-- After your first account has been created, grant admin only to your own UUID:
-- update public.profiles set role='admin' where id='YOUR-AUTH-USER-UUID';


-- Member features: private watchlists and per-user playback progress.
create table if not exists public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references public.anime(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);
create table if not exists public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  position_seconds double precision not null default 0 check (position_seconds >= 0),
  duration_seconds double precision not null default 0 check (duration_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index if not exists watch_progress_user_updated_idx on public.watch_progress(user_id, updated_at desc);
alter table public.watchlist enable row level security;
alter table public.watch_progress enable row level security;
drop policy if exists "Users manage own watchlist" on public.watchlist;
create policy "Users manage own watchlist" on public.watchlist for all to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "Users manage own playback progress" on public.watch_progress;
create policy "Users manage own playback progress" on public.watch_progress for all to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select,insert,update,delete on public.watchlist,public.watch_progress to authenticated;

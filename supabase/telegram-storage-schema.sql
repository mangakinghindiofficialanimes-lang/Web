-- NITIN ANIMES Telegram-backed protected media index.
-- Run after supabase/schema.sql. This stores Telegram file IDs server-side only.
-- Do not create RLS policies or grant table access to anon/authenticated users.
create table if not exists public.telegram_media_assets (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  asset_key text not null,
  asset_role text not null check (asset_role in ('manifest','segment')),
  telegram_file_id text,
  mime_type text not null default 'application/octet-stream',
  manifest_text text,
  created_at timestamptz not null default now(),
  constraint telegram_media_asset_key_safe check (
    asset_key ~ '^[A-Za-z0-9._/-]{1,200}$'
    and asset_key not like '%..%'
    and asset_key not like '/%'
  ),
  constraint telegram_media_asset_role_shape check (
    (asset_role='manifest' and asset_key='manifest.mpd' and manifest_text is not null and telegram_file_id is null)
    or
    (asset_role='segment' and asset_key <> 'manifest.mpd' and manifest_text is null and telegram_file_id is not null)
  ),
  unique (episode_id, asset_key)
);
create index if not exists telegram_media_episode_idx
  on public.telegram_media_assets(episode_id);
alter table public.telegram_media_assets enable row level security;
revoke all on public.telegram_media_assets from anon, authenticated;
-- Supabase service-role access is used only inside the Edge Function.

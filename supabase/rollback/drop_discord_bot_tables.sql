-- Run only when reverting 20260929095502_drop_discord_bot_tables.sql. Restores the schema without the old anon write
-- policies; reload rows from backups/2026-09-29/ and add policies for whatever will write these tables.
begin;
set local lock_timeout = '5s';
create table if not exists limbus.feed_tracker (
  source text primary key,
  last_id text,
  last_checked_at timestamptz default now(),
  last_pub_date timestamptz
);
create table if not exists limbus.guild_settings (
  guild_id text primary key,
  notification_channel_id text,
  steam_enabled boolean default true,
  twitter_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists limbus.guild_feed_history (
  id bigint primary key,
  guild_id text not null,
  source text not null,
  feed_guid text not null,
  pub_date timestamptz,
  sent_at timestamptz default now(),
  unique (guild_id, source, feed_guid)
);
create index if not exists idx_gfh_lookup on limbus.guild_feed_history (guild_id, source, pub_date desc);
create table if not exists limbus.tickets (
  id serial primary key,
  guild_id text not null,
  user_id text not null,
  channel_id text unique,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text,
  transcript_url text
);
create table if not exists limbus.warnings (
  id serial primary key,
  guild_id text not null,
  user_id text not null,
  moderator_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_warnings_guild_user on limbus.warnings (guild_id, user_id);
alter table limbus.feed_tracker enable row level security;
alter table limbus.guild_settings enable row level security;
alter table limbus.guild_feed_history enable row level security;
alter table limbus.tickets enable row level security;
alter table limbus.warnings enable row level security;
commit;

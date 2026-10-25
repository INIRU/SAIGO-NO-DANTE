-- Browser push subscriptions (REQ-COMMUNITY-094, 095). One row per browser: the endpoint is the push service's address
-- for it, so a browser signed in to another account moves to that account (upsert on endpoint). Written and read only
-- by the server (service role); rows go with their account.
create table if not exists limbus.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references limbus.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  lang text not null default 'ko' check (lang in ('ko', 'en', 'ja')),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on limbus.push_subscriptions (user_id);
alter table limbus.push_subscriptions enable row level security;
revoke all on limbus.push_subscriptions from public, anon, authenticated;
grant all on limbus.push_subscriptions to service_role;

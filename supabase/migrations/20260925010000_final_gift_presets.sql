-- Named final-gift presets for the planner: up to 10 per user. NextAuth sessions are checked by server routes; service role only.
create table if not exists limbus.final_gift_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references limbus.profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 10),
  name text not null check (char_length(name) between 1 and 40),
  gift_keys text[] not null default '{}' check (cardinality(gift_keys) <= 60),
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);
alter table limbus.final_gift_presets enable row level security;
revoke all on limbus.final_gift_presets from anon, authenticated;
grant select, insert, update, delete on limbus.final_gift_presets to service_role;

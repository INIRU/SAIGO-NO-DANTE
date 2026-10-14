-- REQ-MIRROR-DUNGEON-019, 021: Mirror Dungeon gift presets of signed-in users, up to five per user. A preset is a name
-- and one to six named groups of gifts, each with a short note. Site-only: the game data sync neither reads nor writes it.
-- NextAuth sessions are checked by the server route (app/api/mirror-dungeon/gift-presets); service role only.
-- Rollback: drop table limbus.gift_presets;

create table limbus.gift_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references limbus.profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  name text not null default '' check (char_length(name) <= 20),
  -- [{ "name": "<up to 20>", "gifts": ["<ego_gifts.game_id>", ...], "memo": "<up to 100>" }], sixty gifts in all.
  -- The route checks each group (lib/mirror-dungeon/gift-preset-code.ts); the table bounds the shape and the size.
  groups jsonb not null check (
    jsonb_typeof(groups) = 'array' and jsonb_array_length(groups) between 1 and 6 and octet_length(groups::text) <= 8192
  ),
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);
alter table limbus.gift_presets enable row level security;
revoke all on limbus.gift_presets from anon, authenticated;
grant select, insert, update, delete on limbus.gift_presets to service_role;

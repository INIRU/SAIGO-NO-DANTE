-- Friend code board (REQ-COMMUNITY-019..023): support line-ups and "wanted identity" posts, written by signed-in users or
-- guests. A post's friend code is shown by its visibility: to anyone, to signed-in users, or to those who gave their own
-- code in exchange. Read and written with the service role only (the code must not reach viewers it is hidden from).
-- Rollback: drop table limbus.friend_want_stats; drop table limbus.friend_exchanges; drop table limbus.friend_posts.

create table limbus.friend_posts (
  id uuid primary key default gen_random_uuid(),
  -- 'support': the identities set as support in the game (up to 12 slots); 'want': identities the author is looking for.
  kind text not null check (kind in ('support', 'want')),
  -- The game's friend code: one capital letter and nine digits.
  code text not null check (code ~ '^[A-Z][0-9]{9}$'),
  visibility text not null default 'public' check (visibility in ('public', 'members', 'exchange')),
  -- support: [{ "slot": 0-11, "identity": "<identities.id>", "egos": { "ZAYIN": "<ego.id>", ... } }]; want: [].
  slots jsonb not null default '[]'::jsonb check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) <= 12),
  -- identities.id of the post (the slots' identities, or the wanted ones), for "posts with this identity".
  identity_ids text[] not null default '{}' check (cardinality(identity_ids) between 1 and 12),
  user_id uuid references limbus.profiles(id) on delete cascade,
  -- Guests: the HMAC of the browser's key (lib/guest/server.ts) and its 4-hex tag shown as "익명 #1a2b".
  key_hash text check (key_hash ~ '^[0-9a-f]{64}$'),
  guest_tag text check (guest_tag ~ '^[0-9a-f]{4}$'),
  created_at timestamptz not null default now(),
  -- Order of the list; moved up by the author at most every 12 hours. Support posts are hidden 30 days after it.
  bumped_at timestamptz not null default now(),
  -- When the author was last on the site.
  seen_at timestamptz not null default now(),
  check (num_nonnulls(user_id, key_hash) = 1),
  check ((key_hash is null) = (guest_tag is null)),
  check (kind = 'support' or (jsonb_array_length(slots) = 0 and cardinality(identity_ids) <= 3))
);
-- One post of each kind per author, and a code is posted once per kind.
create unique index friend_posts_user on limbus.friend_posts (kind, user_id) where user_id is not null;
create unique index friend_posts_guest on limbus.friend_posts (kind, key_hash) where key_hash is not null;
create unique index friend_posts_code on limbus.friend_posts (kind, code);
create index friend_posts_list on limbus.friend_posts (kind, bumped_at desc);
create index friend_posts_identities on limbus.friend_posts using gin (identity_ids);
alter table limbus.friend_posts enable row level security;
revoke all on limbus.friend_posts from anon, authenticated;

-- A viewer gave their own code to see the code of an 'exchange' post; the author sees these on their post.
create table limbus.friend_exchanges (
  post_id uuid not null references limbus.friend_posts(id) on delete cascade,
  viewer_user_id uuid references limbus.profiles(id) on delete cascade,
  viewer_key_hash text check (viewer_key_hash ~ '^[0-9a-f]{64}$'),
  viewer_code text not null check (viewer_code ~ '^[A-Z][0-9]{9}$'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(viewer_user_id, viewer_key_hash) = 1)
);
create unique index friend_exchanges_user on limbus.friend_exchanges (post_id, viewer_user_id) where viewer_user_id is not null;
create unique index friend_exchanges_guest on limbus.friend_exchanges (post_id, viewer_key_hash) where viewer_key_hash is not null;
alter table limbus.friend_exchanges enable row level security;
revoke all on limbus.friend_exchanges from anon, authenticated;

-- "Want" posts are deleted a day after they are written; how often each identity was asked for stays, by day.
create table limbus.friend_want_stats (
  day date not null,
  identity_id text not null,
  count integer not null default 0 check (count >= 0),
  primary key (day, identity_id)
);
alter table limbus.friend_want_stats enable row level security;
revoke all on limbus.friend_want_stats from anon, authenticated;

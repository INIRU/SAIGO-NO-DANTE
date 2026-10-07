-- Friend code board (REQ-COMMUNITY-025): reports of a post, and authors barred from the board (a signed-in user or a guest
-- key). Service role only, like the board's other tables.
-- Rollback: drop table limbus.friend_blocks; drop table limbus.friend_reports.

create table limbus.friend_reports (
  post_id uuid not null references limbus.friend_posts(id) on delete cascade,
  reporter_user_id uuid references limbus.profiles(id) on delete cascade,
  reporter_key_hash text check (reporter_key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(reporter_user_id, reporter_key_hash) = 1)
);
-- One report of a post per reporter.
create unique index friend_reports_user on limbus.friend_reports (post_id, reporter_user_id) where reporter_user_id is not null;
create unique index friend_reports_guest on limbus.friend_reports (post_id, reporter_key_hash) where reporter_key_hash is not null;
alter table limbus.friend_reports enable row level security;
revoke all on limbus.friend_reports from anon, authenticated;

create table limbus.friend_blocks (
  user_id uuid references limbus.profiles(id) on delete cascade,
  key_hash text check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, key_hash) = 1)
);
create unique index friend_blocks_user on limbus.friend_blocks (user_id) where user_id is not null;
create unique index friend_blocks_guest on limbus.friend_blocks (key_hash) where key_hash is not null;
alter table limbus.friend_blocks enable row level security;
revoke all on limbus.friend_blocks from anon, authenticated;

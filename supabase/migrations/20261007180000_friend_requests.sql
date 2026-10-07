-- Friend code board (REQ-COMMUNITY-028): a fourth visibility, 'approval' — a viewer asks for the code and the author
-- approves or declines each request. Service role only, like the board's other tables.
-- Rollback: drop table limbus.friend_requests; then restore the three-value visibility check (no 'approval' rows may remain).

alter table limbus.friend_posts drop constraint friend_posts_visibility_check;
alter table limbus.friend_posts add constraint friend_posts_visibility_check check (visibility in ('public', 'members', 'exchange', 'approval'));

create table limbus.friend_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references limbus.friend_posts(id) on delete cascade,
  viewer_user_id uuid references limbus.profiles(id) on delete cascade,
  viewer_key_hash text check (viewer_key_hash ~ '^[0-9a-f]{64}$'),
  -- Guests are shown to the author by the 4-hex tag of their key, as on posts.
  viewer_tag text check (viewer_tag ~ '^[0-9a-f]{4}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (num_nonnulls(viewer_user_id, viewer_key_hash) = 1),
  check ((viewer_key_hash is null) = (viewer_tag is null))
);
-- One request per viewer and post.
create unique index friend_requests_user on limbus.friend_requests (post_id, viewer_user_id) where viewer_user_id is not null;
create unique index friend_requests_guest on limbus.friend_requests (post_id, viewer_key_hash) where viewer_key_hash is not null;
alter table limbus.friend_requests enable row level security;
revoke all on limbus.friend_requests from anon, authenticated;

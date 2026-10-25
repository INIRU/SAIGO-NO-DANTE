-- Notification kinds a member can turn off (REQ-COMMUNITY-089). All on by default, so existing members keep getting
-- what they get today. The feed and browser pushes read them (community overhaul stage 3 and 4).
set local lock_timeout = '5s';

alter table limbus.profiles
  add column if not exists notify_comments boolean not null default true,
  add column if not exists notify_follows boolean not null default true,
  add column if not exists notify_posts boolean not null default true;

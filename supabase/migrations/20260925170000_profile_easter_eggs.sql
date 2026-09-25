-- Easter eggs found by signed-in users, so hidden achievements follow the account across browsers.
create table limbus.profile_easter_eggs (
  user_id uuid not null references limbus.profiles(id) on delete cascade,
  egg text not null check (egg in ('faust-faces', 'clock-head', 'twisted-star', 'konami', 'lost-manager')),
  found_at timestamptz not null default now(),
  primary key (user_id, egg)
);
alter table limbus.profile_easter_eggs enable row level security;
revoke all on limbus.profile_easter_eggs from anon, authenticated;

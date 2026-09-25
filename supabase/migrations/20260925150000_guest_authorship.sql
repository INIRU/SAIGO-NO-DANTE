-- Anonymous (guest) authorship of decks and plans. The browser keeps a secret key; only its HMAC is stored, in a table
-- no public role can read. decks/md_plans get a 4-hex guest_tag so boards can tell guests apart ("익명 #1a2b").
create table limbus.guest_authorship (
  deck_id uuid references limbus.decks(id) on delete cascade,
  plan_id uuid references limbus.md_plans(id) on delete cascade,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(deck_id, plan_id) = 1)
);
create unique index guest_authorship_deck on limbus.guest_authorship(deck_id) where deck_id is not null;
create unique index guest_authorship_plan on limbus.guest_authorship(plan_id) where plan_id is not null;
create index guest_authorship_key on limbus.guest_authorship(key_hash);
alter table limbus.guest_authorship enable row level security;
revoke all on limbus.guest_authorship from anon, authenticated;

alter table limbus.decks add column guest_tag text check (guest_tag ~ '^[0-9a-f]{4}$');
alter table limbus.md_plans add column guest_tag text check (guest_tag ~ '^[0-9a-f]{4}$');

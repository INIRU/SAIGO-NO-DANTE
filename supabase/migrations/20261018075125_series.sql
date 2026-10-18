-- REQ-COMMUNITY-040..043: series. An author groups their own decks and plans, mixed, in one order.
-- series_items rather than columns on decks/md_plans: one position column orders both kinds, a post is in at most
-- one series (unique per deck_id / plan_id), and the posts tables stay untouched (same shape as guest_authorship).
-- NextAuth sessions are checked by the server routes (app/api/series, deck/plan routes) and write with the service
-- role; anon/authenticated may only read. The trigger below is the DB-side guard: a post joins only its owner's series.
-- Rollback: drop table limbus.series_items; drop table limbus.series; drop function limbus.series_item_owner_check();

create table limbus.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references limbus.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index series_user_created on limbus.series(user_id, created_at desc);

create table limbus.series_items (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references limbus.series(id) on delete cascade,
  deck_id uuid references limbus.decks(id) on delete cascade,
  plan_id uuid references limbus.md_plans(id) on delete cascade,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(deck_id, plan_id) = 1)
);
create unique index series_items_deck on limbus.series_items(deck_id) where deck_id is not null;
create unique index series_items_plan on limbus.series_items(plan_id) where plan_id is not null;
create index series_items_order on limbus.series_items(series_id, position);

create function limbus.series_item_owner_check() returns trigger
language plpgsql set search_path = limbus, pg_temp as $$
declare
  series_owner uuid;
  post_owner uuid;
begin
  select user_id into series_owner from limbus.series where id = new.series_id;
  if new.deck_id is not null then
    select user_id into post_owner from limbus.decks where id = new.deck_id;
  else
    select user_id into post_owner from limbus.md_plans where id = new.plan_id;
  end if;
  if series_owner is null or post_owner is distinct from series_owner then
    raise exception 'a post can only join a series of its own author' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger series_items_owner before insert or update of series_id, deck_id, plan_id on limbus.series_items
  for each row execute function limbus.series_item_owner_check();

alter table limbus.series enable row level security;
alter table limbus.series_items enable row level security;
create policy series_read on limbus.series for select to anon, authenticated using (true);
create policy series_items_read on limbus.series_items for select to anon, authenticated using (true);
revoke all on limbus.series, limbus.series_items from anon, authenticated;
grant select on limbus.series, limbus.series_items to anon, authenticated;
grant select, insert, update, delete on limbus.series, limbus.series_items to service_role;

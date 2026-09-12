create table limbus.ego_passives (
 ego_id uuid not null references limbus.ego(id) on delete cascade,
 game_passive_id bigint not null,
 min_stage integer not null check (min_stage between 1 and 5),
 max_stage integer not null check (max_stage between min_stage and 5),
 name text not null, description text not null,
 name_en text, description_en text, name_jp text, description_jp text,
 primary key (ego_id, game_passive_id)
);
alter table limbus.ego_passives enable row level security;
create policy "Public game passive read" on limbus.ego_passives for select to anon, authenticated using (true);
grant select on limbus.ego_passives to anon, authenticated;
grant all on limbus.ego_passives to service_role;

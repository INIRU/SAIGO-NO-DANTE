-- EGO passives keep the game's flavor line (Passive_Ego `flavor`, first seen on 2021111 and 2051011 in the 2026-10-01 data).
alter table limbus.ego_passives add column if not exists flavor text, add column if not exists flavor_en text, add column if not exists flavor_jp text;
comment on column limbus.ego_passives.flavor is 'Raw Passive_Ego flavor line (KR), when the game has one.';

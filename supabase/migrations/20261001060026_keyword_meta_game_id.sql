-- keyword_meta.game_id: the primary game_text_refs row of a curated keyword (limbus.game_text_refs.id = the game's keyword id,
-- e.g. 'Combustion' for 화상). The site reads the localized names and descriptions from that row; keyword_meta keeps its own
-- name_en/name_jp/description* as the fallback (and for rollback), and the Korean `name` stays the primary key everywhere.
-- Filled by scripts/sync/identity-data.ts --rebuild-keyword-meta (the keyword's own tag, else the single same-name reference,
-- else the same-name reference most used in skill, passive and gift texts; a tie stays null).
-- Additive only: a new nullable column (every row null until the sync runs) and an index, so the foreign key cannot fail on
-- existing data and no row is rewritten. on delete set null: a reference row removed later must not block a sync or lose a keyword.
-- Not unique on purpose: two curated names can share one reference ("공격 레벨 감소" and "공격레벨감소" both match by name
-- ignoring spaces), and the sync decides per name.
begin;
set local lock_timeout = '5s';
alter table limbus.keyword_meta
  add column if not exists game_id text references limbus.game_text_refs (id) on delete set null;
create index if not exists keyword_meta_game_id_idx on limbus.keyword_meta (game_id);
comment on column limbus.keyword_meta.game_id is 'game_text_refs.id of the primary reference of this keyword (display names and descriptions are read from it); null when none or ambiguous';
commit;

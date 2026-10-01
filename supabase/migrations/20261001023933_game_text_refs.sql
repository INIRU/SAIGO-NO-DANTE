-- What a `[Id]` in raw game text stands for: BattleKeywords entries (kind 'keyword') and SkillTag condition labels
-- (kind 'skilltag'), names and descriptions per language as the game wrote them (Unity tags kept). Filled by
-- scripts/sync/game-text-refs.ts from {KR,EN,JP}_BattleKeywords*.txt and *_SkillTag*.txt. keyword_name ties a keyword to
-- its limbus.keyword_meta row (icon, colour, category) by the KR name, whitespace ignored. New table: no rows are rewritten.
begin;
set local lock_timeout = '5s';
create table limbus.game_text_refs (
  id text primary key,
  kind text not null check (kind in ('keyword', 'skilltag')),
  name text,
  name_en text,
  name_jp text,
  description text,
  description_en text,
  description_jp text,
  keyword_name text,
  updated_at timestamptz not null default now()
);
comment on column limbus.game_text_refs.keyword_name is 'keyword_meta.name with the same KR name (whitespace ignored); null for skill tags and unmatched keywords';
alter table limbus.game_text_refs enable row level security;
create policy game_text_refs_public_read on limbus.game_text_refs for select to anon, authenticated using (true);
revoke all on limbus.game_text_refs from anon, authenticated;
grant select on limbus.game_text_refs to anon, authenticated;
grant all on limbus.game_text_refs to service_role;
commit;

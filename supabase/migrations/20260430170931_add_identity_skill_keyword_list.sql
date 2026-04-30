alter table limbus.identities
  add column if not exists skill_keyword_list text[] not null default '{}'::text[],
  add column if not exists unit_keyword_list text[] not null default '{}'::text[],
  add column if not exists association_list text[] not null default '{}'::text[];

create index if not exists identities_skill_keyword_list_gin_idx
  on limbus.identities using gin (skill_keyword_list);

create index if not exists identities_unit_keyword_list_gin_idx
  on limbus.identities using gin (unit_keyword_list);

create index if not exists identities_association_list_gin_idx
  on limbus.identities using gin (association_list);

comment on column limbus.identities.skill_keyword_list is
  'Official representative skill keywords from game JSON personality.skillKeywordList. Existing identities.keywords remains the broader extracted keyword map.';

comment on column limbus.identities.unit_keyword_list is
  'Official unit tags from game JSON personality.unitKeywordList, translated from KR_UnitKeyword. Used for E.G.O gift condition-style unit tag matching separately from display affiliations.';

comment on column limbus.identities.association_list is
  'Official display affiliations from game JSON personality.associationList, translated from KR_AssociationName/KR_UnitKeyword. identities.affiliation remains the first item for compatibility.';

-- RLS note: identities uses table-level row policies for public read access.
-- This migration only adds non-sensitive game-data columns, so no column-specific
-- policy change is required.

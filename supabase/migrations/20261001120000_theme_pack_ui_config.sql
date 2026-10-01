-- Theme pack fields the game keeps in mirrordungeon-theme-floor uiConfigs / KR,EN,JP_MirrorDungeonTheme-1, filled by
-- scripts/sync/mirror-dungeon-data.ts. The title colours used to live in lib/data/theme-pack-colors.ts by hand.
-- Adding nullable or constant-default columns rewrites no rows.
begin;
set local lock_timeout = '5s';
alter table limbus.ego_gift_themes
  add column if not exists name_color text,
  add column if not exists name_segments jsonb,
  add column if not exists attribute_type text,
  add column if not exists attack_type text,
  add column if not exists boss_unit_ids integer[] not null default '{}',
  add column if not exists is_unrecordable boolean not null default false;
comment on column limbus.ego_gift_themes.name_color is 'Title colour on the pack art (uiConfigs.textColor) as #RRGGBB; null = default beige';
comment on column limbus.ego_gift_themes.name_segments is 'Multi-colour title runs per language {ko,en,ja: [{text,color?}]} from specialName';
comment on column limbus.ego_gift_themes.attribute_type is 'Sin affinity the pack is built around (uiConfigs.attributeType)';
comment on column limbus.ego_gift_themes.attack_type is 'Attack type the pack is built around (uiConfigs.attackType)';
comment on column limbus.ego_gift_themes.boss_unit_ids is 'Boss units the pack shows (uiConfigs.showBossIds)';
comment on column limbus.ego_gift_themes.is_unrecordable is 'Runs through this pack are not recorded (isUnrecordable)';
commit;

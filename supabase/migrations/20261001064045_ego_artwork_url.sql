-- Full-size E.G.O art for the detail hero: the public URL of `{game id}_cg-{hash12}.webp` in Storage, set by the sync
-- (scripts/sync/ego-artwork.ts) and backfilled by scripts/sync/backfill-ego-artwork-url.ts. Null = the site falls back to
-- lib/generated/ego-artwork.json, then to the 256px _awaken_profile. A nullable column rewrites no rows; public read follows the
-- table's existing grants.
begin;
set local lock_timeout = '5s';
alter table limbus.ego add column if not exists artwork_url text;
comment on column limbus.ego.artwork_url is 'Public URL of the full-size E.G.O art ({game_id}_cg-{sha256 first 12 hex}.webp, WebP q95), shown in the detail hero; null = fall back to the hand-kept map, then image_url';
commit;

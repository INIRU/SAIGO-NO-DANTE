-- The corrosion (erosion) full art of an EGO for the detail hero's corrosion tab, written by apply-extraction and
-- backfill-ego-artwork-url.ts like artwork_url.
alter table limbus.ego add column if not exists corrosion_artwork_url text;
comment on column limbus.ego.corrosion_artwork_url is 'Public URL of the corrosion (erosion) full art, {id}_e_cg.webp (older: {id}_cg_e.webp); the detail hero shows it on the corrosion tab. Null when the EGO has no corrosion art.';

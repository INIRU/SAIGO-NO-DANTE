alter table limbus.skills add column if not exists image_id text;
comment on column limbus.skills.image_id is 'Original game skill sprite ID; preserves transformed skills independently of display order.';

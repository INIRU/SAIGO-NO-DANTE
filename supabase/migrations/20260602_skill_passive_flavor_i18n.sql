alter table limbus.skills
  add column if not exists flavor text,
  add column if not exists flavor_en text,
  add column if not exists flavor_jp text;

alter table limbus.passives
  add column if not exists flavor text,
  add column if not exists flavor_en text,
  add column if not exists flavor_jp text;

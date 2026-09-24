-- Uptie (동기화) level per deck identity, 1–4. Existing rows default to IV.
alter table limbus.deck_identities
  add column if not exists uptie smallint not null default 4
  constraint deck_identities_uptie_check check (uptie between 1 and 4);

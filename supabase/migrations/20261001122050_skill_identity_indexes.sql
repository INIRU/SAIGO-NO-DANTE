-- The site reads skills by identity (detail pages, notes, decks) and deck slots by identity (deck search);
-- neither had an index besides the primary key, so every read scanned the table.
create index if not exists skills_identity_id_idx on limbus.skills(identity_id, skill_order);
create index if not exists deck_identities_identity_id_idx on limbus.deck_identities(identity_id);

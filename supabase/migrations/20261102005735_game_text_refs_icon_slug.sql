-- The buff's own icon: `icons/keywords/<icon_slug>.webp`, as the game finds art by buff id and keyword_meta has one row per name.
-- Null: draw keyword_meta.icon_slug. Already applied to the database.
alter table limbus.game_text_refs add column if not exists icon_slug text;

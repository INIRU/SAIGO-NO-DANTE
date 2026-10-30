-- When a deck's content was last saved by its author (not views, votes or comments, which also bump updated_at).
-- Set by the deck edit API; the analysis counts a deck edited within its period. md_plans has the same column.
alter table limbus.decks add column if not exists content_edited_at timestamptz;

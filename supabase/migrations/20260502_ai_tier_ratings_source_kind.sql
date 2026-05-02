-- Distinguish the source unit for AI tier opinion samples.
-- source_type remains available for platform/source labels such as dcinside,
-- arca, youtube, wiki, etc.

ALTER TABLE limbus.ai_tier_ratings
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'comment';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'limbus.ai_tier_ratings'::regclass
      AND conname = 'ai_tier_ratings_source_kind_check'
  ) THEN
    ALTER TABLE limbus.ai_tier_ratings
      ADD CONSTRAINT ai_tier_ratings_source_kind_check
      CHECK (source_kind IN ('comment', 'post', 'image', 'video', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_tier_ratings_source_kind
  ON limbus.ai_tier_ratings(source_kind);

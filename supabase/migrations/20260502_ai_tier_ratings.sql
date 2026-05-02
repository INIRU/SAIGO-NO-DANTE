-- AI-collected tier opinion samples.
-- These rows are separate from user-authored limbus.tier_ratings so automation
-- does not need dummy auth.users/profiles records.

CREATE TABLE IF NOT EXISTS limbus.ai_tier_ratings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id         UUID NOT NULL REFERENCES limbus.identities(id) ON DELETE CASCADE,
  category            VARCHAR NOT NULL,
  score               INT NOT NULL CHECK (score BETWEEN 1 AND 10),
  comment             TEXT NOT NULL DEFAULT '',
  evidence_excerpt    TEXT NOT NULL DEFAULT '',
  source_type         TEXT NOT NULL DEFAULT 'community',
  source_url          TEXT,
  source_hash         TEXT NOT NULL,
  source_author_hash  TEXT,
  content_hash        TEXT NOT NULL,
  run_id              TEXT NOT NULL,
  model               TEXT NOT NULL DEFAULT '',
  confidence          NUMERIC(4,3) NOT NULL DEFAULT 1,
  weight              NUMERIC(6,3) NOT NULL DEFAULT 1,
  source_published_at TIMESTAMPTZ,
  collected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_tier_ratings_category_check
    CHECK (category IN ('reroll', 'mirror_dungeon', 'goodstuff')),
  CONSTRAINT ai_tier_ratings_comment_length_check
    CHECK (char_length(comment) <= 280),
  CONSTRAINT ai_tier_ratings_excerpt_length_check
    CHECK (char_length(evidence_excerpt) <= 1000),
  CONSTRAINT ai_tier_ratings_source_type_length_check
    CHECK (char_length(source_type) BETWEEN 1 AND 64),
  CONSTRAINT ai_tier_ratings_source_hash_length_check
    CHECK (char_length(source_hash) BETWEEN 16 AND 128),
  CONSTRAINT ai_tier_ratings_content_hash_length_check
    CHECK (char_length(content_hash) BETWEEN 16 AND 128),
  CONSTRAINT ai_tier_ratings_run_id_length_check
    CHECK (char_length(run_id) BETWEEN 1 AND 128),
  CONSTRAINT ai_tier_ratings_model_length_check
    CHECK (char_length(model) <= 128),
  CONSTRAINT ai_tier_ratings_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT ai_tier_ratings_weight_check
    CHECK (weight > 0 AND weight <= 10),
  UNIQUE(identity_id, category, source_hash, content_hash)
);

DROP TRIGGER IF EXISTS ai_tier_ratings_updated_at ON limbus.ai_tier_ratings;
CREATE TRIGGER ai_tier_ratings_updated_at
  BEFORE UPDATE ON limbus.ai_tier_ratings
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

ALTER TABLE limbus.ai_tier_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tier_ratings_select" ON limbus.ai_tier_ratings;
CREATE POLICY "ai_tier_ratings_select" ON limbus.ai_tier_ratings
  FOR SELECT USING (true);

GRANT SELECT ON limbus.ai_tier_ratings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON limbus.ai_tier_ratings TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_tier_ratings_identity_category
  ON limbus.ai_tier_ratings(identity_id, category);

CREATE INDEX IF NOT EXISTS idx_ai_tier_ratings_identity_category_created
  ON limbus.ai_tier_ratings(identity_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tier_ratings_run
  ON limbus.ai_tier_ratings(run_id);

CREATE INDEX IF NOT EXISTS idx_ai_tier_ratings_source
  ON limbus.ai_tier_ratings(source_hash, content_hash);

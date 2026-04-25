-- Tier list categories and category-aware user ratings.
-- Create only; do not run against production without the normal deployment path.

ALTER TABLE limbus.tier_list
  ADD COLUMN IF NOT EXISTS category VARCHAR NOT NULL DEFAULT 'reroll';

ALTER TABLE limbus.tier_list
  ALTER COLUMN tier TYPE VARCHAR;

UPDATE limbus.tier_list
SET category = 'reroll'
WHERE category IS NULL;

UPDATE limbus.tier_list
SET tier = 'N/A'
WHERE tier NOT IN ('S+', 'S', 'A', 'B', 'C', 'N/A');

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'limbus.tier_list'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%tier%'
  LOOP
    EXECUTE format('ALTER TABLE limbus.tier_list DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'limbus.tier_list'::regclass
      AND contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY key.ordinality)
        FROM unnest(conkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute att
          ON att.attrelid = 'limbus.tier_list'::regclass
         AND att.attnum = key.attnum
      ) = ARRAY['identity_id']
  LOOP
    EXECUTE format('ALTER TABLE limbus.tier_list DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE limbus.tier_list
  DROP CONSTRAINT IF EXISTS tier_list_category_check;

ALTER TABLE limbus.tier_list
  DROP CONSTRAINT IF EXISTS tier_list_tier_check;

ALTER TABLE limbus.tier_list
  ADD CONSTRAINT tier_list_category_check
  CHECK (category IN ('reroll', 'overall', 'mirror_dungeon', 'goodstuff'));

ALTER TABLE limbus.tier_list
  ADD CONSTRAINT tier_list_tier_check
  CHECK (tier IN ('S+', 'S', 'A', 'B', 'C', 'N/A'));

DROP INDEX IF EXISTS limbus.idx_tier_list_identity;
DROP INDEX IF EXISTS limbus.tier_list_identity_id_key;
DROP INDEX IF EXISTS limbus.idx_tier_list_category_identity;
DROP INDEX IF EXISTS limbus.idx_tier_list_category_sort;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_list_category_identity
  ON limbus.tier_list(category, identity_id);

CREATE INDEX IF NOT EXISTS idx_tier_list_category_sort
  ON limbus.tier_list(category, sort_order);

CREATE TABLE IF NOT EXISTS limbus.tier_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES limbus.identities(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  category    VARCHAR NOT NULL,
  score       INT NOT NULL CHECK (score BETWEEN 1 AND 10),
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tier_ratings_category_check
    CHECK (category IN ('reroll', 'mirror_dungeon', 'goodstuff')),
  CONSTRAINT tier_ratings_comment_length_check
    CHECK (char_length(comment) <= 280),
  UNIQUE(identity_id, user_id, category)
);

DROP TRIGGER IF EXISTS tier_ratings_updated_at ON limbus.tier_ratings;
CREATE TRIGGER tier_ratings_updated_at
  BEFORE UPDATE ON limbus.tier_ratings
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

ALTER TABLE limbus.tier_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_ratings_select" ON limbus.tier_ratings;
CREATE POLICY "tier_ratings_select" ON limbus.tier_ratings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tier_ratings_insert" ON limbus.tier_ratings;
CREATE POLICY "tier_ratings_insert" ON limbus.tier_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tier_ratings_update" ON limbus.tier_ratings;
CREATE POLICY "tier_ratings_update" ON limbus.tier_ratings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tier_ratings_delete" ON limbus.tier_ratings;
CREATE POLICY "tier_ratings_delete" ON limbus.tier_ratings
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tier_ratings_identity_category
  ON limbus.tier_ratings(identity_id, category);

CREATE INDEX IF NOT EXISTS idx_tier_ratings_user_category
  ON limbus.tier_ratings(user_id, category);

CREATE INDEX IF NOT EXISTS idx_tier_ratings_identity_category_created
  ON limbus.tier_ratings(identity_id, category, created_at DESC);

CREATE TABLE IF NOT EXISTS limbus.tier_rating_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id   UUID NOT NULL REFERENCES limbus.tier_ratings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT 'inappropriate',
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tier_rating_reports_status_check
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'resolved')),
  UNIQUE(rating_id, reporter_id)
);

ALTER TABLE limbus.tier_rating_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_rating_reports_insert" ON limbus.tier_rating_reports;
CREATE POLICY "tier_rating_reports_insert" ON limbus.tier_rating_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "tier_rating_reports_update" ON limbus.tier_rating_reports;
CREATE POLICY "tier_rating_reports_update" ON limbus.tier_rating_reports
  FOR UPDATE USING (auth.uid() = reporter_id AND status = 'pending')
  WITH CHECK (auth.uid() = reporter_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS idx_tier_rating_reports_rating
  ON limbus.tier_rating_reports(rating_id);

CREATE INDEX IF NOT EXISTS idx_tier_rating_reports_reporter
  ON limbus.tier_rating_reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_tier_rating_reports_status_created
  ON limbus.tier_rating_reports(status, created_at DESC);

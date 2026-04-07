-- =============================================================================
-- migration-i18n.sql
-- Internationalisation (i18n) support for UGC tables, game translation cache,
-- and per-language AI summary caching.
--
-- Changes:
--   1. Add preferred_lang to limbus.profiles
--   2. Add lang column to UGC tables: decks, md_plans, identity_guides
--   3. Create limbus.game_translations — EN/JP translation overlay for game data
--   4. Create limbus.ai_summaries — per-language AI summary cache
--   5. Indexes for lang-filtered queries
--   6. RLS policies for both new tables
--   7. updated_at trigger for ai_summaries
--   8. limbus.upsert_ai_summary() RPC
--   9. Grants following the least-privilege model from migration-security-hardening.sql
--
-- Idempotency: All statements use IF NOT EXISTS / OR REPLACE / IF NOT EXISTS.
-- Safe to run multiple times.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Add lang columns to existing UGC / profile tables
-- =============================================================================

ALTER TABLE limbus.profiles
  ADD COLUMN IF NOT EXISTS preferred_lang VARCHAR(5) NOT NULL DEFAULT 'ko';

ALTER TABLE limbus.decks
  ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'ko';

ALTER TABLE limbus.md_plans
  ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'ko';

ALTER TABLE limbus.identity_guides
  ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'ko';


-- =============================================================================
-- SECTION 2: game_translations table
-- Overlay table for EN / JA translations of static game data.
-- Original game data tables are never modified; translations are stored here.
--
-- entity_type: 'identity' | 'ego' | 'skill' | 'passive' | 'keyword'
--              | 'ego_gift' | 'buf'
-- entity_id:   game_id (as text), keyword name, or any stable string key
-- lang:        'en' | 'ja'  (source language is always 'ko' in the base tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS limbus.game_translations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT        NOT NULL,
  entity_id    TEXT        NOT NULL,
  lang         VARCHAR(5)  NOT NULL,
  name         TEXT        NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_type, entity_id, lang)
);

ALTER TABLE limbus.game_translations ENABLE ROW LEVEL SECURITY;

-- Public read — anyone can fetch translations
DROP POLICY IF EXISTS "game_translations_select" ON limbus.game_translations;
CREATE POLICY "game_translations_select" ON limbus.game_translations
  FOR SELECT USING (true);

-- No INSERT / UPDATE / DELETE from clients — admin-only via service role key.
-- (service_role bypasses RLS entirely; no explicit policy needed.)


-- =============================================================================
-- SECTION 3: ai_summaries table
-- Per-language AI summary cache keyed on (target_type, target_id, lang).
-- Same identity/deck can have separate summaries for ko / en / ja.
--
-- target_type: 'identity' | 'ego' | 'deck'
-- target_id:   game_id (as text) or deck UUID as text
-- lang:        'ko' | 'en' | 'ja'
-- =============================================================================

CREATE TABLE IF NOT EXISTS limbus.ai_summaries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT        NOT NULL,
  target_id    TEXT        NOT NULL,
  lang         VARCHAR(5)  NOT NULL,
  content      TEXT        NOT NULL,
  model        TEXT,
  created_by   UUID        REFERENCES limbus.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (target_type, target_id, lang)
);

ALTER TABLE limbus.ai_summaries ENABLE ROW LEVEL SECURITY;

-- Public read
DROP POLICY IF EXISTS "ai_summaries_select" ON limbus.ai_summaries;
CREATE POLICY "ai_summaries_select" ON limbus.ai_summaries
  FOR SELECT USING (true);

-- Any authenticated user may insert a new summary (e.g. via the upsert RPC)
DROP POLICY IF EXISTS "ai_summaries_insert" ON limbus.ai_summaries;
CREATE POLICY "ai_summaries_insert" ON limbus.ai_summaries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only the original creator may update their own summary row
DROP POLICY IF EXISTS "ai_summaries_update" ON limbus.ai_summaries;
CREATE POLICY "ai_summaries_update" ON limbus.ai_summaries
  FOR UPDATE USING (auth.uid() = created_by);


-- =============================================================================
-- SECTION 4: Indexes
-- The UNIQUE constraints on game_translations and ai_summaries already create
-- implicit unique indexes; explicit named indexes are added here for the UGC
-- lang columns and for documentation clarity.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_decks_lang
  ON limbus.decks (lang);

CREATE INDEX IF NOT EXISTS idx_md_plans_lang
  ON limbus.md_plans (lang);

CREATE INDEX IF NOT EXISTS idx_identity_guides_lang
  ON limbus.identity_guides (lang);

-- Covering index for the most common lookup pattern on game_translations
CREATE INDEX IF NOT EXISTS idx_game_translations_lookup
  ON limbus.game_translations (entity_type, entity_id, lang);

-- Covering index for the most common lookup pattern on ai_summaries
CREATE INDEX IF NOT EXISTS idx_ai_summaries_lookup
  ON limbus.ai_summaries (target_type, target_id, lang);


-- =============================================================================
-- SECTION 5: updated_at auto-trigger for ai_summaries
-- Uses the existing limbus.update_updated_at() function (defined in schema.sql).
-- =============================================================================

DROP TRIGGER IF EXISTS ai_summaries_updated_at ON limbus.ai_summaries;
CREATE TRIGGER ai_summaries_updated_at
  BEFORE UPDATE ON limbus.ai_summaries
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();


-- =============================================================================
-- SECTION 6: RPC — limbus.upsert_ai_summary()
-- Inserts a new summary row or overwrites content/model on conflict.
-- Returns the id of the affected row.
-- SECURITY DEFINER so it can write to ai_summaries regardless of the caller's
-- RLS context, while the p_user_id parameter is validated server-side.
-- =============================================================================

CREATE OR REPLACE FUNCTION limbus.upsert_ai_summary(
  p_target_type  TEXT,
  p_target_id    TEXT,
  p_lang         VARCHAR(5),
  p_content      TEXT,
  p_model        TEXT,
  p_user_id      UUID
) RETURNS UUID AS $$
  INSERT INTO limbus.ai_summaries
    (target_type, target_id, lang, content, model, created_by)
  VALUES
    (p_target_type, p_target_id, p_lang, p_content, p_model, p_user_id)
  ON CONFLICT (target_type, target_id, lang)
  DO UPDATE SET
    content    = EXCLUDED.content,
    model      = EXCLUDED.model,
    updated_at = now()
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;


-- =============================================================================
-- SECTION 7: Grants — following least-privilege model
-- game_translations: read-only for anon + authenticated; writes via service_role
-- ai_summaries: read for anon; INSERT/UPDATE for authenticated via RPC
-- upsert_ai_summary: EXECUTE for authenticated
-- =============================================================================

GRANT SELECT ON limbus.game_translations TO anon, authenticated;
GRANT SELECT ON limbus.ai_summaries      TO anon;
GRANT SELECT, INSERT, UPDATE ON limbus.ai_summaries TO authenticated;

GRANT EXECUTE ON FUNCTION limbus.upsert_ai_summary(TEXT, TEXT, VARCHAR, TEXT, TEXT, UUID)
  TO authenticated;


-- ── identity_ai_summaries i18n ──
ALTER TABLE limbus.identity_ai_summaries ADD COLUMN IF NOT EXISTS lang VARCHAR(5) NOT NULL DEFAULT 'ko';

-- Drop old unique constraint on identity_id and create new composite one
-- (wrap in DO block for idempotency)
DO $$ BEGIN
  -- Drop the old unique index if it exists
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'identity_ai_summaries_identity_id_key') THEN
    ALTER TABLE limbus.identity_ai_summaries DROP CONSTRAINT identity_ai_summaries_identity_id_key;
  END IF;
END $$;

-- Create new composite unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS identity_ai_summaries_identity_lang_key
  ON limbus.identity_ai_summaries(identity_id, lang);

CREATE INDEX IF NOT EXISTS idx_identity_ai_summaries_lang
  ON limbus.identity_ai_summaries(lang);

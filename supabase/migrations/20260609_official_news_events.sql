-- Official news calendar events.
-- Threat model: official feed rows are public read content, but feed ingestion,
-- mutation, Storage ownership, and cleanup are service-role automation only.
-- RLS exposes SELECT to anon/authenticated and defines no public write policy.

CREATE TABLE IF NOT EXISTS limbus.official_news_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,
  source_item_id  TEXT NOT NULL,
  source_url      TEXT NOT NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL DEFAULT '',
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  image_url       TEXT,
  image_path      TEXT,
  image_bucket    TEXT DEFAULT 'limbus-assets',
  locale          VARCHAR(5),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  raw_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT official_news_events_source_check
    CHECK (source IN ('steam', 'x')),
  CONSTRAINT official_news_events_source_item_id_check
    CHECK (char_length(source_item_id) BETWEEN 1 AND 256),
  CONSTRAINT official_news_events_source_url_check
    CHECK (source_url ~ '^https://'),
  CONSTRAINT official_news_events_title_check
    CHECK (char_length(title) BETWEEN 1 AND 500),
  CONSTRAINT official_news_events_end_after_start_check
    CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT official_news_events_locale_check
    CHECK (locale IS NULL OR locale IN ('ko', 'en', 'ja', 'ko-KR', 'en-US', 'ja-JP')),
  CONSTRAINT official_news_events_image_owner_check
    CHECK (
      image_path IS NULL OR (
        image_bucket = 'limbus-assets'
        AND image_path LIKE 'official-news/%'
      )
    ),
  UNIQUE (source, source_item_id)
);

DROP TRIGGER IF EXISTS official_news_events_updated_at ON limbus.official_news_events;
CREATE TRIGGER official_news_events_updated_at
  BEFORE UPDATE ON limbus.official_news_events
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

ALTER TABLE limbus.official_news_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "official_news_events_select" ON limbus.official_news_events;
CREATE POLICY "official_news_events_select" ON limbus.official_news_events
  FOR SELECT USING (true);

GRANT SELECT ON limbus.official_news_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON limbus.official_news_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_official_news_events_starts_at
  ON limbus.official_news_events (starts_at);

CREATE INDEX IF NOT EXISTS idx_official_news_events_source_published
  ON limbus.official_news_events (source, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_official_news_events_cleanup
  ON limbus.official_news_events ((COALESCE(ends_at, starts_at)));

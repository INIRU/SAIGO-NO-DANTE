-- Add gallery image arrays for official news calendar events.
-- Threat model: official feed rows are public read content, but feed ingestion,
-- mutation, Storage ownership, and cleanup remain service-role automation only.
-- The legacy image_url/image_path columns stay as representative first image fields.

ALTER TABLE limbus.official_news_events
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_paths TEXT[] NOT NULL DEFAULT '{}';

UPDATE limbus.official_news_events
SET
  image_urls = CASE
    WHEN cardinality(image_urls) = 0 AND image_url IS NOT NULL AND image_url <> '' THEN ARRAY[image_url]
    ELSE image_urls
  END,
  image_paths = CASE
    WHEN cardinality(image_paths) = 0 AND image_path IS NOT NULL AND image_path <> '' THEN ARRAY[image_path]
    ELSE image_paths
  END
WHERE (cardinality(image_urls) = 0 OR cardinality(image_paths) = 0)
  AND (image_url IS NOT NULL OR image_path IS NOT NULL);

ALTER TABLE limbus.official_news_events
  DROP CONSTRAINT IF EXISTS official_news_events_image_arrays_not_null_check,
  ADD CONSTRAINT official_news_events_image_arrays_not_null_check
    CHECK (image_urls IS NOT NULL AND image_paths IS NOT NULL);

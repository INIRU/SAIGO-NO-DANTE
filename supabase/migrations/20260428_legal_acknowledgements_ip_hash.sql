CREATE TABLE IF NOT EXISTS limbus.legal_docs (
  type TEXT NOT NULL CHECK (type IN ('terms', 'privacy')),
  lang TEXT NOT NULL DEFAULT 'ko',
  title TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  last_updated TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE limbus.legal_docs
  ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'ko',
  ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE limbus.legal_docs
SET lang = COALESCE(NULLIF(lang, ''), 'ko'),
    version = CASE
      WHEN NULLIF(btrim(version), '') IS NULL THEN 'v1'
      WHEN btrim(version) ~* '^v[0-9]+([._-][0-9A-Za-z]+)*$' THEN lower(btrim(version))
      ELSE 'v1'
    END,
    updated_at = COALESCE(updated_at, now());

WITH existing_langs AS (
  SELECT DISTINCT COALESCE(NULLIF(btrim(lang), ''), 'ko') AS lang
  FROM limbus.legal_docs
),
required_docs(type) AS (
  VALUES ('terms'), ('privacy')
)
INSERT INTO limbus.legal_docs (type, lang, title, version, last_updated, sections, updated_at)
SELECT
  required_docs.type,
  existing_langs.lang,
  source_doc.title,
  source_doc.version,
  source_doc.last_updated,
  source_doc.sections,
  now()
FROM existing_langs
CROSS JOIN required_docs
JOIN LATERAL (
  SELECT title, version, last_updated, sections
  FROM limbus.legal_docs source_doc
  WHERE source_doc.type = required_docs.type
  ORDER BY
    CASE
      WHEN source_doc.lang = existing_langs.lang THEN 0
      WHEN source_doc.lang = 'ko' THEN 1
      ELSE 2
    END,
    source_doc.updated_at DESC
  LIMIT 1
) source_doc ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM limbus.legal_docs existing_doc
  WHERE existing_doc.type = required_docs.type
    AND existing_doc.lang = existing_langs.lang
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_docs_type_lang_key
  ON limbus.legal_docs (type, lang);

CREATE TABLE IF NOT EXISTS limbus.legal_acknowledgements (
  user_id UUID NOT NULL REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('terms', 'privacy')),
  version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doc_type, version)
);

ALTER TABLE limbus.legal_acknowledgements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'limbus'
      AND tablename = 'legal_acknowledgements'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON limbus.legal_acknowledgements', existing_policy.policyname);
  END LOOP;
END $$;

REVOKE ALL ON limbus.legal_acknowledgements FROM anon, authenticated;
GRANT ALL ON limbus.legal_acknowledgements TO service_role;

CREATE INDEX IF NOT EXISTS idx_legal_acknowledgements_user_doc
  ON limbus.legal_acknowledgements (user_id, doc_type, acknowledged_at DESC);

INSERT INTO limbus.legal_acknowledgements (user_id, doc_type, version, acknowledged_at)
SELECT
  profiles.id,
  current_docs.type,
  current_docs.version,
  now()
FROM limbus.profiles profiles
CROSS JOIN (
  SELECT DISTINCT type, version
  FROM limbus.legal_docs
  WHERE type IN ('terms', 'privacy')
    AND NULLIF(btrim(version), '') IS NOT NULL
) current_docs
ON CONFLICT (user_id, doc_type, version) DO NOTHING;

ALTER TABLE limbus.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_ip_masked TEXT,
  ADD COLUMN IF NOT EXISTS last_user_agent_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_country TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_last_ip_hash
  ON limbus.profiles (last_ip_hash);

CREATE INDEX IF NOT EXISTS idx_profiles_last_user_agent_hash
  ON limbus.profiles (last_user_agent_hash);

DROP FUNCTION IF EXISTS limbus.record_profile_activity(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION limbus.record_profile_activity(
  user_email TEXT,
  request_ip_hash TEXT DEFAULT NULL,
  request_ip_masked TEXT DEFAULT NULL,
  request_user_agent_hash TEXT DEFAULT NULL,
  request_country TEXT DEFAULT NULL
)
RETURNS UUID AS $$
  UPDATE limbus.profiles p
  SET
    last_seen_at = now(),
    last_ip = NULL,
    last_ip_hash = COALESCE(NULLIF(request_ip_hash, ''), p.last_ip_hash),
    last_ip_masked = COALESCE(NULLIF(request_ip_masked, ''), p.last_ip_masked),
    last_user_agent_hash = COALESCE(NULLIF(request_user_agent_hash, ''), p.last_user_agent_hash),
    last_country = COALESCE(NULLIF(upper(request_country), ''), p.last_country)
  FROM auth.users u
  WHERE p.id = u.id
    AND u.email = user_email
  RETURNING p.id;
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE ALL ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

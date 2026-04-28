-- Private strong duplicate-signal snapshots for admin review.
-- Stores profile IDs and short hash fingerprints only; raw IP and raw
-- user-agent values must not be persisted here.

CREATE TABLE IF NOT EXISTS limbus.profile_duplicate_signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  signal_grade TEXT NOT NULL DEFAULT 'strong',
  matched_profile_ids UUID[] NOT NULL DEFAULT '{}',
  match_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_duplicate_signal_events_grade_check CHECK (signal_grade IN ('strong')),
  CONSTRAINT profile_duplicate_signal_events_profile_grade_key UNIQUE (profile_id, signal_grade)
);

ALTER TABLE limbus.profile_duplicate_signal_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON limbus.profile_duplicate_signal_events FROM anon, authenticated;
GRANT ALL ON limbus.profile_duplicate_signal_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_profile_duplicate_signal_events_profile
  ON limbus.profile_duplicate_signal_events (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_duplicate_signal_events_last_detected
  ON limbus.profile_duplicate_signal_events (last_detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_duplicate_signal_events_snapshot_gin
  ON limbus.profile_duplicate_signal_events USING GIN (match_snapshot);

CREATE OR REPLACE FUNCTION limbus.record_profile_activity(
  user_email TEXT,
  request_ip_hash TEXT DEFAULT NULL,
  request_ip_masked TEXT DEFAULT NULL,
  request_user_agent_hash TEXT DEFAULT NULL,
  request_country TEXT DEFAULT NULL,
  request_device_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  recorded_profile_id UUID;
  normalized_ip_hash TEXT := NULLIF(request_ip_hash, '');
  normalized_ip_masked TEXT := NULLIF(request_ip_masked, '');
  normalized_user_agent_hash TEXT := NULLIF(request_user_agent_hash, '');
  normalized_country TEXT := NULLIF(upper(request_country), '');
  normalized_device_hash TEXT := NULLIF(request_device_hash, '');
  device_matched_profile_ids UUID[] := '{}';
  combined_matched_profile_ids UUID[] := '{}';
  matched_profile_ids UUID[] := '{}';
  reasons JSONB := '[]'::jsonb;
  strong_snapshot JSONB;
BEGIN
  UPDATE limbus.profiles p
  SET
    last_seen_at = now(),
    last_ip = NULL,
    last_ip_hash = COALESCE(normalized_ip_hash, p.last_ip_hash),
    last_ip_masked = COALESCE(normalized_ip_masked, p.last_ip_masked),
    last_user_agent_hash = COALESCE(normalized_user_agent_hash, p.last_user_agent_hash),
    last_device_hash = COALESCE(normalized_device_hash, p.last_device_hash),
    last_country = COALESCE(normalized_country, p.last_country)
  FROM auth.users u
  WHERE p.id = u.id
    AND u.email = user_email
  RETURNING p.id INTO recorded_profile_id;

  IF recorded_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO limbus.profile_access_signals (
    profile_id,
    seen_at,
    ip_hash,
    ip_masked,
    user_agent_hash,
    device_hash,
    country
  )
  VALUES (
    recorded_profile_id,
    now(),
    normalized_ip_hash,
    normalized_ip_masked,
    normalized_user_agent_hash,
    normalized_device_hash,
    normalized_country
  );

  DELETE FROM limbus.profile_access_signals stale
  WHERE stale.profile_id = recorded_profile_id
    AND stale.id NOT IN (
      SELECT recent.id
      FROM limbus.profile_access_signals recent
      WHERE recent.profile_id = recorded_profile_id
      ORDER BY recent.seen_at DESC, recent.created_at DESC, recent.id DESC
      LIMIT 5
    );

  IF normalized_device_hash IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT matched.profile_id), '{}'::uuid[])
    INTO device_matched_profile_ids
    FROM (
      SELECT p.id AS profile_id
      FROM limbus.profiles p
      WHERE p.id <> recorded_profile_id
        AND p.last_device_hash = normalized_device_hash
      UNION
      SELECT s.profile_id
      FROM limbus.profile_access_signals s
      WHERE s.profile_id <> recorded_profile_id
        AND s.device_hash = normalized_device_hash
    ) matched;

    IF array_length(device_matched_profile_ids, 1) IS NOT NULL THEN
      reasons := reasons || jsonb_build_array(jsonb_build_object(
        'type', 'device',
        'device_hash_fingerprint', concat(left(normalized_device_hash, 6), '...', right(normalized_device_hash, 4)),
        'matched_profile_ids', to_jsonb(device_matched_profile_ids)
      ));
    END IF;
  END IF;

  IF normalized_ip_hash IS NOT NULL AND normalized_user_agent_hash IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT matched.profile_id), '{}'::uuid[])
    INTO combined_matched_profile_ids
    FROM (
      SELECT p.id AS profile_id
      FROM limbus.profiles p
      WHERE p.id <> recorded_profile_id
        AND p.last_ip_hash = normalized_ip_hash
        AND p.last_user_agent_hash = normalized_user_agent_hash
      UNION
      SELECT s.profile_id
      FROM limbus.profile_access_signals s
      WHERE s.profile_id <> recorded_profile_id
        AND s.ip_hash = normalized_ip_hash
        AND s.user_agent_hash = normalized_user_agent_hash
    ) matched;

    IF array_length(combined_matched_profile_ids, 1) IS NOT NULL THEN
      reasons := reasons || jsonb_build_array(jsonb_build_object(
        'type', 'ip_user_agent',
        'ip_hash_fingerprint', concat(left(normalized_ip_hash, 6), '...', right(normalized_ip_hash, 4)),
        'user_agent_hash_fingerprint', concat(left(normalized_user_agent_hash, 6), '...', right(normalized_user_agent_hash, 4)),
        'matched_profile_ids', to_jsonb(combined_matched_profile_ids)
      ));
    END IF;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT profile_id), '{}'::uuid[])
  INTO matched_profile_ids
  FROM (
    SELECT unnest(device_matched_profile_ids) AS profile_id
    UNION
    SELECT unnest(combined_matched_profile_ids) AS profile_id
  ) merged;

  IF array_length(matched_profile_ids, 1) IS NOT NULL THEN
    strong_snapshot := jsonb_build_object(
      'schema_version', 1,
      'detected_at', now(),
      'source', 'record_profile_activity',
      'profile_id', recorded_profile_id,
      'signal_grade', 'strong',
      'matched_profile_ids', to_jsonb(matched_profile_ids),
      'reasons', reasons
    );

    INSERT INTO limbus.profile_duplicate_signal_events (
      profile_id,
      signal_grade,
      matched_profile_ids,
      match_snapshot,
      last_detected_at,
      updated_at
    )
    VALUES (
      recorded_profile_id,
      'strong',
      matched_profile_ids,
      strong_snapshot,
      now(),
      now()
    )
    ON CONFLICT (profile_id, signal_grade) DO UPDATE
    SET
      matched_profile_ids = (
        SELECT COALESCE(array_agg(DISTINCT merged_profile_id), '{}'::uuid[])
        FROM unnest(limbus.profile_duplicate_signal_events.matched_profile_ids || EXCLUDED.matched_profile_ids) AS merged(merged_profile_id)
      ),
      match_snapshot = EXCLUDED.match_snapshot,
      last_detected_at = EXCLUDED.last_detected_at,
      updated_at = EXCLUDED.updated_at;

    INSERT INTO limbus.profile_duplicate_signal_events (
      profile_id,
      signal_grade,
      matched_profile_ids,
      match_snapshot,
      last_detected_at,
      updated_at
    )
    SELECT
      matched_profile_id,
      'strong',
      ARRAY[recorded_profile_id]::uuid[],
      jsonb_build_object(
        'schema_version', 1,
        'detected_at', now(),
        'source', 'record_profile_activity',
        'profile_id', matched_profile_id,
        'signal_grade', 'strong',
        'matched_profile_ids', jsonb_build_array(recorded_profile_id),
        'counterparty_profile_id', recorded_profile_id,
        'reasons', reasons
      ),
      now(),
      now()
    FROM unnest(matched_profile_ids) AS matched(matched_profile_id)
    ON CONFLICT (profile_id, signal_grade) DO UPDATE
    SET
      matched_profile_ids = (
        SELECT COALESCE(array_agg(DISTINCT merged_profile_id), '{}'::uuid[])
        FROM unnest(limbus.profile_duplicate_signal_events.matched_profile_ids || EXCLUDED.matched_profile_ids) AS merged(merged_profile_id)
      ),
      match_snapshot = EXCLUDED.match_snapshot,
      last_detected_at = EXCLUDED.last_detected_at,
      updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN recorded_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = limbus, public;

REVOKE ALL ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

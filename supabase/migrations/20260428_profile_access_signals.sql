-- Private recent access signals for duplicate-account review.
-- Stores only keyed hashes and coarse/masked metadata; raw IP and raw user-agent
-- values must not be persisted here.

ALTER TABLE limbus.profiles
  ADD COLUMN IF NOT EXISTS last_device_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_last_device_hash
  ON limbus.profiles (last_device_hash);

CREATE TABLE IF NOT EXISTS limbus.profile_access_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES limbus.profiles(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT,
  ip_masked TEXT,
  user_agent_hash TEXT,
  device_hash TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE limbus.profile_access_signals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON limbus.profile_access_signals FROM anon, authenticated;
GRANT ALL ON limbus.profile_access_signals TO service_role;

CREATE INDEX IF NOT EXISTS idx_profile_access_signals_profile_seen
  ON limbus.profile_access_signals (profile_id, seen_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_access_signals_ip_hash
  ON limbus.profile_access_signals (ip_hash);

CREATE INDEX IF NOT EXISTS idx_profile_access_signals_user_agent_hash
  ON limbus.profile_access_signals (user_agent_hash);

CREATE INDEX IF NOT EXISTS idx_profile_access_signals_device_hash
  ON limbus.profile_access_signals (device_hash);

DROP FUNCTION IF EXISTS limbus.record_profile_activity(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT);

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
BEGIN
  UPDATE limbus.profiles p
  SET
    last_seen_at = now(),
    last_ip = NULL,
    last_ip_hash = COALESCE(NULLIF(request_ip_hash, ''), p.last_ip_hash),
    last_ip_masked = COALESCE(NULLIF(request_ip_masked, ''), p.last_ip_masked),
    last_user_agent_hash = COALESCE(NULLIF(request_user_agent_hash, ''), p.last_user_agent_hash),
    last_device_hash = COALESCE(NULLIF(request_device_hash, ''), p.last_device_hash),
    last_country = COALESCE(NULLIF(upper(request_country), ''), p.last_country)
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
    NULLIF(request_ip_hash, ''),
    NULLIF(request_ip_masked, ''),
    NULLIF(request_user_agent_hash, ''),
    NULLIF(request_device_hash, ''),
    NULLIF(upper(request_country), '')
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

  RETURN recorded_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = limbus, public;

REVOKE ALL ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

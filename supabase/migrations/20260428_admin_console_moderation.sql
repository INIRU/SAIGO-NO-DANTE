-- Admin console moderation metadata.
-- Threat model: these columns are written through server-side admin/API code using
-- service-role Supabase clients. Existing RLS remains in force for direct clients.

ALTER TABLE limbus.profiles
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES limbus.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_country TEXT;

ALTER TABLE limbus.audit_logs
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON limbus.profiles (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_until ON limbus.profiles (suspended_until);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON limbus.audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON limbus.audit_logs (target_type, target_id);

CREATE OR REPLACE FUNCTION limbus.is_user_suspended(user_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      p.suspended IS TRUE
      AND (p.suspended_until IS NULL OR p.suspended_until > now())
    ),
    FALSE
  )
  FROM limbus.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION limbus.record_profile_activity(
  user_email TEXT,
  request_ip TEXT DEFAULT NULL,
  request_country TEXT DEFAULT NULL
)
RETURNS UUID AS $$
  UPDATE limbus.profiles p
  SET
    last_seen_at = now(),
    last_ip = COALESCE(NULLIF(request_ip, ''), p.last_ip),
    last_country = COALESCE(NULLIF(upper(request_country), ''), p.last_country)
  FROM auth.users u
  WHERE p.id = u.id
    AND u.email = user_email
  RETURNING p.id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION limbus.is_user_suspended(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION limbus.record_profile_activity(TEXT, TEXT, TEXT) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION limbus.expire_suspensions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired AS (
    SELECT
      id,
      username,
      suspension_reason,
      suspended_until,
      suspended_at,
      suspended_by
    FROM limbus.profiles
    WHERE suspended IS TRUE
      AND suspended_until IS NOT NULL
      AND suspended_until <= now()
    FOR UPDATE SKIP LOCKED
  ),
  audit_rows AS (
    INSERT INTO limbus.audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      details,
      severity,
      created_at
    )
    SELECT
      NULL,
      'suspension_expired',
      'user',
      expired.id::TEXT,
      jsonb_build_object(
        'username', expired.username,
        'reason', expired.suspension_reason,
        'suspended_until', expired.suspended_until,
        'suspended_at', expired.suspended_at,
        'suspended_by', expired.suspended_by
      ),
      'info',
      now()
    FROM expired
    RETURNING target_id::UUID AS profile_id
  ),
  updated AS (
    UPDATE limbus.profiles profiles
    SET
      suspended = FALSE,
      suspension_reason = NULL,
      suspended_until = NULL,
      suspended_at = NULL,
      suspended_by = NULL
    FROM audit_rows
    WHERE profiles.id = audit_rows.profile_id
    RETURNING profiles.id
  )
  SELECT count(*) INTO expired_count FROM updated;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = limbus, public;

REVOKE ALL ON FUNCTION limbus.expire_suspensions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION limbus.expire_suspensions() TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'expire-suspensions-every-15-minutes'
  ) THEN
    UPDATE cron.job
    SET
      schedule = '*/15 * * * *',
      command = 'SELECT limbus.expire_suspensions();',
      database = current_database(),
      username = current_user,
      active = TRUE
    WHERE jobname = 'expire-suspensions-every-15-minutes';
  ELSE
    PERFORM cron.schedule(
      'expire-suspensions-every-15-minutes',
      '*/15 * * * *',
      'SELECT limbus.expire_suspensions();'
    );
  END IF;
END $$;

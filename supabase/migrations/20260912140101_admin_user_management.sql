-- Moderation reasons are private; all current audit readers/writers are server-side.
REVOKE ALL ON limbus.audit_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION limbus.admin_list_users(p_search text DEFAULT '', p_status text DEFAULT 'all', p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH filtered AS (
    SELECT p.id, p.username, p.avatar_url, p.created_at, p.last_seen_at,
      (p.suspended IS TRUE AND (p.suspended_until IS NULL OR p.suspended_until > now())) AS restricted
    FROM limbus.profiles p JOIN auth.users u ON u.id = p.id
    WHERE (p_search = '' OR strpos(lower(coalesce(p.username,'')), lower(p_search)) > 0
      OR strpos(lower(coalesce(u.email,'')), lower(p_search)) > 0)
      AND (p_status = 'all' OR (p.suspended IS TRUE AND (p.suspended_until IS NULL OR p.suspended_until > now())) = (p_status = 'suspended'))
  ), page AS (
    SELECT * FROM filtered ORDER BY created_at DESC, id LIMIT least(greatest(p_limit,1),50) OFFSET greatest(p_offset,0)
  )
  SELECT jsonb_build_object('users', coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id) FROM page), '[]'::jsonb), 'total', (SELECT count(*) FROM filtered));
$$;

CREATE OR REPLACE FUNCTION limbus.admin_moderate_user(p_actor_email text, p_target_id uuid, p_suspend boolean, p_reason text, p_days integer, p_expected_suspended_at timestamptz, p_admin_emails text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor limbus.profiles%ROWTYPE;
  target limbus.profiles%ROWTYPE;
  target_email text;
  active boolean;
  until_date timestamptz;
BEGIN
  SELECT p.* INTO actor FROM limbus.profiles p JOIN auth.users u ON u.id=p.id WHERE u.email=p_actor_email FOR SHARE OF p;
  IF actor.id IS NULL OR (coalesce(actor.role,'user') <> 'admin' AND NOT (p_actor_email = ANY(coalesce(p_admin_emails, ARRAY[]::text[]))))
    OR (actor.suspended IS TRUE AND (actor.suspended_until IS NULL OR actor.suspended_until > now())) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;
  SELECT * INTO target FROM limbus.profiles WHERE id=p_target_id FOR UPDATE;
  IF target.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
  SELECT email INTO target_email FROM auth.users WHERE id=p_target_id;
  IF actor.id = target.id OR coalesce(target.role,'user') <> 'user' OR target_email = ANY(coalesce(p_admin_emails, ARRAY[]::text[])) THEN
    RETURN jsonb_build_object('error','protected');
  END IF;
  active := target.suspended IS TRUE AND (target.suspended_until IS NULL OR target.suspended_until > now());
  IF p_suspend = active OR target.suspended_at IS DISTINCT FROM p_expected_suspended_at THEN
    RETURN jsonb_build_object('error','conflict');
  END IF;
  IF p_suspend IS NULL OR (p_suspend AND (length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 OR (p_days IS NOT NULL AND p_days NOT IN (7,30)))) THEN
    RETURN jsonb_build_object('error','invalid');
  END IF;
  until_date := CASE WHEN p_suspend AND p_days IS NOT NULL THEN now() + make_interval(days => p_days) ELSE NULL END;
  UPDATE limbus.profiles SET suspended=p_suspend,
    suspension_reason=CASE WHEN p_suspend THEN btrim(p_reason) ELSE NULL END,
    suspended_until=until_date, suspended_at=CASE WHEN p_suspend THEN now() ELSE NULL END,
    suspended_by=CASE WHEN p_suspend THEN actor.id ELSE NULL END
  WHERE id=p_target_id;
  INSERT INTO limbus.audit_logs(actor_id,action,target_type,target_id,details,severity)
  VALUES(actor.id, CASE WHEN p_suspend THEN 'suspend' ELSE 'unsuspend' END, 'user',p_target_id::text,
    jsonb_build_object('reason',CASE WHEN p_suspend THEN btrim(p_reason) ELSE target.suspension_reason END,
      'suspended_until',until_date,'previous_suspended_until',target.suspended_until), 'warning');
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION limbus.admin_list_users(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION limbus.admin_list_users(text,text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION limbus.admin_moderate_user(text,uuid,boolean,text,integer,timestamptz,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION limbus.admin_moderate_user(text,uuid,boolean,text,integer,timestamptz,text[]) TO service_role;

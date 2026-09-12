-- updated_at also changes when counters change. Only successful editor saves
-- (already recorded in the private audit log) belong in the edited shelf.
CREATE OR REPLACE FUNCTION limbus.discovery_recent_edits(p_kind text)
RETURNS TABLE(entity_id text, edited_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT a.target_id, max(a.created_at) AS edited_at
  FROM limbus.audit_logs a
  WHERE (p_kind='deck' AND a.action='deck_update' AND a.target_type='deck'
      AND EXISTS (SELECT 1 FROM limbus.decks d WHERE d.id::text=a.target_id))
    OR (p_kind='planner' AND a.action='planner_update' AND a.target_type='planner'
      AND EXISTS (SELECT 1 FROM limbus.md_plans p WHERE p.id::text=a.target_id))
  GROUP BY a.target_id ORDER BY edited_at DESC, a.target_id LIMIT 6;
$$;
REVOKE ALL ON FUNCTION limbus.discovery_recent_edits(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION limbus.discovery_recent_edits(text) TO service_role;

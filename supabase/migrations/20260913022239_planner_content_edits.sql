-- Old save logs contain field names, not before/after values; do not backfill
-- them as verified edits. Keep the audit history intact.
ALTER TABLE limbus.md_plans ADD COLUMN content_edited_at timestamptz;

CREATE FUNCTION limbus.track_plan_content_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_edited_at := NULL;
  ELSIF ROW(NEW.title, NEW.description, NEW.difficulty, NEW.deck, NEW.egos,
            NEW.floor_plan, NEW.gift_inventory, NEW.tags, NEW.lang)
        IS DISTINCT FROM
        ROW(OLD.title, OLD.description, OLD.difficulty, OLD.deck, OLD.egos,
            OLD.floor_plan, OLD.gift_inventory, OLD.tags, OLD.lang) THEN
    NEW.content_edited_at := clock_timestamp();
  ELSE
    NEW.content_edited_at := OLD.content_edited_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION limbus.track_plan_content_edit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER track_plan_content_edit
BEFORE INSERT OR UPDATE ON limbus.md_plans
FOR EACH ROW EXECUTE FUNCTION limbus.track_plan_content_edit();

CREATE OR REPLACE FUNCTION limbus.discovery_recent_edits(p_kind text)
RETURNS TABLE(entity_id text, edited_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT edits.entity_id, edits.edited_at FROM (
    SELECT a.target_id AS entity_id, max(a.created_at) AS edited_at
    FROM limbus.audit_logs a
    WHERE p_kind = 'deck' AND a.action = 'deck_update' AND a.target_type = 'deck'
      AND EXISTS (SELECT 1 FROM limbus.decks d WHERE d.id::text = a.target_id)
    GROUP BY a.target_id
    UNION ALL
    SELECT p.id::text, p.content_edited_at
    FROM limbus.md_plans p
    WHERE p_kind = 'planner' AND p.content_edited_at IS NOT NULL
  ) edits ORDER BY edits.edited_at DESC, edits.entity_id LIMIT 6;
$$;
REVOKE ALL ON FUNCTION limbus.discovery_recent_edits(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION limbus.discovery_recent_edits(text) TO service_role;

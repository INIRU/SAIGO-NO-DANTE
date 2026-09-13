-- All fixture data rolls back; run after planner_content_edits migration.
BEGIN;
DO $$
DECLARE
  u uuid := gen_random_uuid(); p uuid := gen_random_uuid(); stamp timestamptz;
BEGIN
  INSERT INTO auth.users(id, email) VALUES(u, u::text || '@example.invalid');
  INSERT INTO limbus.profiles(id, username) VALUES(u, u::text) ON CONFLICT(id) DO NOTHING;
  INSERT INTO limbus.md_plans(id, user_id, title, deck, content_edited_at)
    VALUES(p, u, 'Fixture', '[{"identity_id":"one","slot":1}]', now());
  ASSERT (SELECT content_edited_at IS NULL FROM limbus.md_plans WHERE id = p);

  -- Upload, unchanged re-save, JSON key order, counters and forged edit dates
  -- must never qualify as a content edit, even with old-style save audit logs.
  UPDATE limbus.md_plans SET title = 'Fixture', deck = '[{"slot":1,"identity_id":"one"}]',
    view_count = 5, vote_count = 2, comment_count = 1, updated_at = now(), content_edited_at = now() WHERE id = p;
  INSERT INTO limbus.audit_logs(actor_id, action, target_type, target_id)
    VALUES(u, 'planner_create', 'planner', p::text), (u, 'planner_update', 'planner', p::text);
  ASSERT NOT EXISTS(SELECT 1 FROM limbus.discovery_recent_edits('planner') WHERE entity_id = p::text);

  UPDATE limbus.md_plans SET title = 'Edited' WHERE id = p;
  SELECT content_edited_at INTO stamp FROM limbus.md_plans WHERE id = p;
  ASSERT stamp IS NOT NULL;
  ASSERT EXISTS(SELECT 1 FROM limbus.discovery_recent_edits('planner') WHERE entity_id = p::text AND edited_at = stamp);
  UPDATE limbus.md_plans SET title = 'Edited', view_count = 6, content_edited_at = NULL WHERE id = p;
  ASSERT (SELECT content_edited_at = stamp FROM limbus.md_plans WHERE id = p);
  UPDATE limbus.md_plans SET floor_plan = '[{"floor":1,"gift_ids":["gift"]}]' WHERE id = p;
  ASSERT (SELECT content_edited_at > stamp FROM limbus.md_plans WHERE id = p);
  ASSERT NOT has_function_privilege('anon', 'limbus.discovery_recent_edits(text)', 'execute');
  ASSERT NOT has_function_privilege('authenticated', 'limbus.track_plan_content_edit()', 'execute');
END $$;
ROLLBACK;

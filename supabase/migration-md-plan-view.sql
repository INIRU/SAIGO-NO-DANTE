-- Atomic view count increment for md_plans
-- Replaces the non-atomic SELECT + UPDATE pattern in /api/planner/[id]/view

CREATE OR REPLACE FUNCTION limbus.increment_md_plan_view(plan_id UUID)
RETURNS void AS $$
  UPDATE limbus.md_plans SET view_count = view_count + 1 WHERE id = plan_id;
$$ LANGUAGE sql SECURITY DEFINER;

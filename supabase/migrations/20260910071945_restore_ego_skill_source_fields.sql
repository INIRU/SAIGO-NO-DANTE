-- Keep source skill identity and sanity cost when importing normalized EGO skills.
ALTER TABLE limbus.ego_skills
  ADD COLUMN IF NOT EXISTS game_skill_id integer,
  ADD COLUMN IF NOT EXISTS mental_consume integer;
COMMENT ON COLUMN limbus.ego_skills.game_skill_id IS 'Unity source skill id; stable across interpretation stages';
COMMENT ON COLUMN limbus.ego_skills.mental_consume IS 'Sanity cost from the resolved skillData.mpUsage for this stage';

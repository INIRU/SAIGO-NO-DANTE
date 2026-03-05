-- EGO 스킬 테이블
CREATE TABLE IF NOT EXISTS limbus.ego_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ego_id UUID NOT NULL REFERENCES limbus.ego(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skill_type TEXT,
  sin_affinity TEXT,
  base_power INT,
  coin_power INT,
  coins INT,
  atk_weight INT,
  skill_order INT DEFAULT 1,
  offense_level INT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ego_skills_ego_id ON limbus.ego_skills(ego_id);

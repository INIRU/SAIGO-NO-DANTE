-- EGO 기프트 테이블 (거울 던전)
-- 이 파일은 참고용. 실제 마이그레이션은 Supabase Dashboard에서 실행됨.

CREATE TABLE IF NOT EXISTS limbus.ego_gifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  keyword         TEXT NOT NULL,
  grade           TEXT NOT NULL,
  tier            TEXT,
  enhancement     BOOLEAN DEFAULT false,
  price           INT,
  sell_price       INT,
  buy_disabled    BOOLEAN DEFAULT false,
  effect_base     TEXT,
  effect_plus     TEXT,
  effect_plusplus  TEXT,
  min_identities  INT,
  is_synthesis    BOOLEAN DEFAULT false,
  first_appearance TEXT,
  related         TEXT,
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS limbus.ego_gift_recipes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_name     TEXT NOT NULL,
  keyword         TEXT NOT NULL,
  ingredients     TEXT[] NOT NULL,
  final_result    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE limbus.ego_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE limbus.ego_gift_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ego_gifts_public_read" ON limbus.ego_gifts
  FOR SELECT USING (true);

CREATE POLICY "ego_gift_recipes_public_read" ON limbus.ego_gift_recipes
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_ego_gifts_keyword ON limbus.ego_gifts(keyword);
CREATE INDEX IF NOT EXISTS idx_ego_gifts_grade ON limbus.ego_gifts(grade);
CREATE INDEX IF NOT EXISTS idx_ego_gift_recipes_keyword ON limbus.ego_gift_recipes(keyword);

-- 정신력 섹션 DB FK 변환
-- panic_type, sanity_increase, sanity_decrease → 정규화된 테이블

-- 1. panic_types 테이블
CREATE TABLE IF NOT EXISTS limbus.panic_types (
  id int PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL
);

INSERT INTO limbus.panic_types (id, name, description) VALUES
  (9999, '패닉', '한 턴 동안 행동하지 않음'),
  (9994, '패닉', '한 턴 동안 행동하지 않음')
ON CONFLICT (id) DO NOTHING;

-- 2. mental_condition_templates 테이블
CREATE TABLE IF NOT EXISTS limbus.mental_condition_templates (
  id text PRIMARY KEY,
  add_text text NOT NULL,
  min_text text NOT NULL
);

-- 3. identity_sanity_conditions 테이블
CREATE TABLE IF NOT EXISTS limbus.identity_sanity_conditions (
  id serial PRIMARY KEY,
  identity_id uuid NOT NULL REFERENCES limbus.identities(id) ON DELETE CASCADE,
  template_id text NOT NULL REFERENCES limbus.mental_condition_templates(id),
  condition_type text NOT NULL CHECK (condition_type IN ('increase', 'decrease')),
  params int[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_isc_identity ON limbus.identity_sanity_conditions(identity_id);

-- 4. identities.panic_type FK 변경 (데이터 시드 후 실행)
-- ALTER TABLE limbus.identities ALTER COLUMN panic_type TYPE int USING panic_type::int;
-- ALTER TABLE limbus.identities ADD CONSTRAINT fk_identities_panic_type FOREIGN KEY (panic_type) REFERENCES limbus.panic_types(id);

-- 5. 기존 컬럼 제거 (데이터 이전 확인 후 실행)
-- ALTER TABLE limbus.identities DROP COLUMN IF EXISTS sanity_increase;
-- ALTER TABLE limbus.identities DROP COLUMN IF EXISTS sanity_decrease;
-- ALTER TABLE limbus.identities DROP COLUMN IF EXISTS panic_description;

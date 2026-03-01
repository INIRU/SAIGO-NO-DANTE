-- 패시브 테이블 생성
-- Supabase Dashboard > SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS limbus.passives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID REFERENCES limbus.identities(id) ON DELETE CASCADE,
  passive_type TEXT NOT NULL,      -- 'battle' 또는 'support'
  name        TEXT NOT NULL,
  sin_affinity TEXT,               -- 발동 조건 죄악 타입 (분노, 색욕 등). 없으면 NULL
  sin_count   INT,                 -- 필요 자원 수
  active_cond TEXT,                -- 발동 조건 유형 (공명, 보유 등)
  description TEXT,
  passive_order INT DEFAULT 1      -- 같은 타입 내 순서
);

-- RLS 설정
ALTER TABLE limbus.passives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "passives_select" ON limbus.passives FOR SELECT USING (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_passives_identity ON limbus.passives(identity_id);

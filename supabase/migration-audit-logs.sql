-- 감사 로그 테이블
-- 관리자/완장 활동 기록

CREATE TABLE IF NOT EXISTS limbus.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES limbus.profiles(id),
  action      TEXT NOT NULL,           -- 'role_change', 'guide_create', 'guide_update', 'guide_delete', 'suspend', 'unsuspend', 'deck_delete'
  target_type TEXT,                    -- 'user', 'guide', 'deck'
  target_id   TEXT,                    -- 대상 ID
  details     JSONB DEFAULT '{}',      -- 추가 정보 (이전값, 이후값 등)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE limbus.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select" ON limbus.audit_logs FOR SELECT USING (true);

-- 인덱스
CREATE INDEX idx_audit_logs_created ON limbus.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_action ON limbus.audit_logs (action);

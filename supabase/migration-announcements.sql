-- 공지사항 테이블 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS limbus.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  pinned      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON limbus.announcements
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

-- RLS 활성화 (service role key로 접근하므로 RLS 우회됨)
ALTER TABLE limbus.announcements ENABLE ROW LEVEL SECURITY;

-- 공지는 누구나 읽기 가능
CREATE POLICY "announcements_select" ON limbus.announcements FOR SELECT USING (true);

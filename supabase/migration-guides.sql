-- 운영법(가이드) 테이블
-- 인격당 여러 개의 가이드 허용

CREATE TABLE IF NOT EXISTS limbus.identity_guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES limbus.identities(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES limbus.profiles(id),
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- updated_at 자동 갱신
CREATE TRIGGER identity_guides_updated_at
  BEFORE UPDATE ON limbus.identity_guides
  FOR EACH ROW EXECUTE FUNCTION limbus.update_updated_at();

-- RLS
ALTER TABLE limbus.identity_guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guides_select" ON limbus.identity_guides FOR SELECT USING (true);

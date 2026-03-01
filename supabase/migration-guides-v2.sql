-- 운영법 v2: 인격당 여러 개 가이드 허용 + 제목 추가
-- 기존 UNIQUE 제약 제거, title 컬럼 추가

ALTER TABLE limbus.identity_guides ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE limbus.identity_guides DROP CONSTRAINT IF EXISTS identity_guides_identity_id_key;

-- profiles 테이블에 bio 컬럼 추가
-- Supabase SQL Editor에서 직접 실행하세요.

ALTER TABLE limbus.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- supabase/grant-limbus.sql
-- Supabase SQL Editor에서 실행하세요.
-- limbus 스키마에 anon / authenticated / service_role 권한을 부여합니다.

GRANT USAGE ON SCHEMA limbus TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES     IN SCHEMA limbus TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES  IN SCHEMA limbus TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES   IN SCHEMA limbus TO anon, authenticated, service_role;

-- 이후 생성되는 테이블/시퀀스/함수에도 자동 적용
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT ALL ON ROUTINES  TO anon, authenticated, service_role;

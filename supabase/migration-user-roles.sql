-- 유저 역할/정지 관리 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor

-- 1) profiles 테이블에 role, suspended 컬럼 추가
ALTER TABLE limbus.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE limbus.profiles ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;

-- 2) 이메일로 유저 역할을 조회하는 RPC 함수 (NextAuth JWT 콜백에서 호출)
CREATE OR REPLACE FUNCTION limbus.get_user_role(user_email TEXT)
RETURNS TEXT AS $$
  SELECT COALESCE(p.role, 'user')
  FROM limbus.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3) 이메일로 유저 정지 상태를 조회하는 RPC 함수
CREATE OR REPLACE FUNCTION limbus.is_user_suspended(user_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(p.suspended, FALSE)
  FROM limbus.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

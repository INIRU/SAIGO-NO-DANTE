-- Migration: 동기화 단계별 스킬/패시브 데이터 + 인격 추가 메타데이터
-- 적용일: 2026-03-02

-- skills 테이블에 동기화 단계 컬럼 추가 (기존 데이터는 모두 level 3)
ALTER TABLE limbus.skills ADD COLUMN IF NOT EXISTS uptie_level INT DEFAULT 3;

-- passives 테이블에도 동기화 단계 컬럼 추가
ALTER TABLE limbus.passives ADD COLUMN IF NOT EXISTS uptie_level INT DEFAULT 3;

-- identities 테이블에 추가 메타데이터
-- panic_type: '공격' 또는 '방어'
-- sanity_increase/decrease: 정신력 증감 조건 텍스트
ALTER TABLE limbus.identities ADD COLUMN IF NOT EXISTS panic_type TEXT;
ALTER TABLE limbus.identities ADD COLUMN IF NOT EXISTS sanity_increase TEXT;
ALTER TABLE limbus.identities ADD COLUMN IF NOT EXISTS sanity_decrease TEXT;

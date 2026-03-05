-- rarity 컬럼을 TEXT('1성','2성','3성') → INTEGER(1,2,3)로 변환
-- 1. 임시 컬럼 추가
ALTER TABLE limbus.identities ADD COLUMN rarity_int INTEGER;

-- 2. 데이터 변환
UPDATE limbus.identities SET rarity_int = CASE
  WHEN rarity = '1성' THEN 1
  WHEN rarity = '2성' THEN 2
  WHEN rarity = '3성' THEN 3
  ELSE 1
END;

-- 3. 기존 컬럼 삭제 & 새 컬럼 이름 변경
ALTER TABLE limbus.identities DROP COLUMN rarity;
ALTER TABLE limbus.identities RENAME COLUMN rarity_int TO rarity;

-- 4. 기본값 설정
ALTER TABLE limbus.identities ALTER COLUMN rarity SET DEFAULT 1;
ALTER TABLE limbus.identities ALTER COLUMN rarity SET NOT NULL;

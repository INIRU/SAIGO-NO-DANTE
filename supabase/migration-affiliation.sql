-- 인격 소속 컬럼 추가 + 키워드 메타 테이블
-- Supabase Dashboard > SQL Editor에서 실행

-- ① 인격에 소속 컬럼 추가
ALTER TABLE limbus.identities ADD COLUMN IF NOT EXISTS affiliation TEXT;

-- ② 소속 데이터 입력 (이상 인격 15개)
UPDATE limbus.identities SET affiliation = 'LCB' WHERE name = 'LCB Sinner';
UPDATE limbus.identities SET affiliation = '세븐 협회' WHERE name = 'Seven Assoc. South Section 6';
UPDATE limbus.identities SET affiliation = '검계' WHERE name = 'Blade Lineage Salsu';
UPDATE limbus.identities SET affiliation = '개화 E.G.O' WHERE name = 'Effloresced E.G.O Spicebush';
UPDATE limbus.identities SET affiliation = '어금니 사무소' WHERE name = 'Molar Office Fixer';
UPDATE limbus.identities SET affiliation = 'W사' WHERE name = 'W Corp. L3 Cleanup Agent';
UPDATE limbus.identities SET affiliation = '피쿼드호' WHERE name = 'The Pequod First Mate';
UPDATE limbus.identities SET affiliation = '디에치 협회' WHERE name = 'Dieci Assoc. South Section 4';
UPDATE limbus.identities SET affiliation = '약지' WHERE name = 'The Ring Pointillist Student';
UPDATE limbus.identities SET affiliation = '로보토미 E.G.O' WHERE name = 'Lobotomy E.G.O Solemn Lament';
UPDATE limbus.identities SET affiliation = 'LCE E.G.O' WHERE name = 'LCE E.G.O Lantern';
UPDATE limbus.identities SET affiliation = '리우 협회' WHERE name = 'Liu Assoc. South Section 3';
UPDATE limbus.identities SET affiliation = 'N사 E.G.O' WHERE name = 'N Corp. E.G.O Fell Bullet';
UPDATE limbus.identities SET affiliation = '흑수' WHERE name = 'Heishou Pack - Wu Branch Adept';
UPDATE limbus.identities SET affiliation = '거미집' WHERE name = 'The House of Spiders The Index Nursefather';

-- ③ 키워드 메타 테이블 생성
CREATE TABLE IF NOT EXISTS limbus.keyword_meta (
  name        TEXT PRIMARY KEY,
  description TEXT,
  max_stack   INT
);

-- RLS 설정
ALTER TABLE limbus.keyword_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "keyword_meta_select" ON limbus.keyword_meta FOR SELECT USING (true);

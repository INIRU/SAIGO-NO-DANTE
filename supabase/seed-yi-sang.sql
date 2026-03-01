-- 이상(Yi Sang) 인격 + EGO 시드 데이터
-- 단빵숲(baslimbus.info) + 나무위키 + Supabase Storage 폴더명 기반
-- 실행: Supabase Dashboard > SQL Editor

-- ──────────────────────────────────────────────────────────
-- ① 이상 인격 (Identities) — 15개
-- ──────────────────────────────────────────────────────────

-- 기존 이상 인격 삭제 후 재삽입
DELETE FROM limbus.identities WHERE sinner_id = 'yi-sang';

INSERT INTO limbus.identities (sinner_id, name, name_kr, tier, hp, speed_min, speed_max, def_level, sin_affinity, keywords, rarity)
VALUES
  -- 1성
  ('yi-sang', 'LCB Sinner',                                     'LCB 수감자',                1, 221, 4, 8, 58, 'sloth',    ARRAY['LCB', '림버스 컴퍼니'],           '1성'),

  -- 2성
  ('yi-sang', 'Seven Assoc. South Section 6',                    '남부 세븐 협회 6과',        1, 178, 3, 7, 42, 'pride',    ARRAY['세븐 협회'],                       '2성'),
  ('yi-sang', 'Molar Office Fixer',                              '어금니 사무소 해결사',      1, 192, 3, 7, 48, 'envy',     ARRAY['어금니 사무소'],                   '2성'),
  ('yi-sang', 'The Pequod First Mate',                           '피쿼드호 일등 항해사',      1, 203, 4, 7, 52, 'gloom',    ARRAY['피쿼드호'],                        '2성'),
  ('yi-sang', 'Dieci Assoc. South Section 4',                    '남부 디에치 협회 4과',      1, 185, 3, 6, 45, 'sloth',    ARRAY['디에치 협회'],                     '2성'),
  ('yi-sang', 'LCE E.G.O Lantern',                               'LCE E.G.O::초롱',          1, 190, 3, 7, 46, 'pride',    ARRAY['LCE'],                             '2성'),

  -- 3성
  ('yi-sang', 'Blade Lineage Salsu',                             '검계 살수',                 1, 172, 3, 7, 40, 'gloom',    ARRAY['검계'],                            '3성'),
  ('yi-sang', 'Effloresced E.G.O Spicebush',                    '개화 E.G.O::동백',          1, 195, 2, 5, 50, 'sloth',    ARRAY['개화 E.G.O'],                      '3성'),
  ('yi-sang', 'W Corp. L3 Cleanup Agent',                        'W사 3등급 정리 요원',       1, 243, 4, 7, 62, 'pride',    ARRAY['W사'],                             '3성'),
  ('yi-sang', 'The Ring Pointillist Student',                    '약지 점묘파 스튜던트',      1, 188, 3, 6, 48, 'gluttony', ARRAY['약지', '점묘파'],                  '3성'),
  ('yi-sang', 'Lobotomy E.G.O Solemn Lament',                   '로보토미 E.G.O::엄숙한 애도', 1, 210, 3, 7, 55, 'sloth', ARRAY['로보토미 E.G.O'],                  '3성'),
  ('yi-sang', 'Liu Assoc. South Section 3',                      '남부 리우 협회 3과',        1, 200, 3, 8, 52, 'wrath',   ARRAY['리우 협회'],                       '3성'),
  ('yi-sang', 'N Corp. E.G.O Fell Bullet',                       'N사 E.G.O::흉탄',          1, 218, 3, 7, 56, 'pride',    ARRAY['N사', 'E.G.O'],                    '3성'),
  ('yi-sang', 'Heishou Pack - Wu Branch Adept',                  '흑수 - 오 필두',           1, 230, 3, 7, 58, 'sloth',    ARRAY['흑수', '홍원'],                    '3성'),
  ('yi-sang', 'The House of Spiders The Index Nursefather',      '거미집 검지 아비',          1, 225, 2, 5, 60, 'gloom',   ARRAY['거미집', '검지'],                  '3성');


-- ──────────────────────────────────────────────────────────
-- ② 이상 EGO — 8개
-- ──────────────────────────────────────────────────────────

DELETE FROM limbus.ego WHERE sinner_id = 'yi-sang';

INSERT INTO limbus.ego (sinner_id, name, name_kr, grade, sin_affinity, description, corrosion_risk)
VALUES
  -- ZAYIN (자인)
  ('yi-sang', 'Crow_s Eye View',       '오감도',       'ZAYIN', 'sloth',    '까마귀의 눈으로 바라본 세계', '낮음'),
  ('yi-sang', 'Bygone Days',           '지난 날',      'ZAYIN', 'gloom',    '지나간 날들의 기억',          '낮음'),

  -- TETH (테스)
  ('yi-sang', '4th Match Flame',       '4번째 성냥불', 'TETH',  'wrath',    '네 번째 성냥의 불꽃',         '보통'),
  ('yi-sang', 'Wishing Cairn',         '소망석',       'TETH',  'gluttony', '소망을 담은 돌탑',            '보통'),

  -- HE (헤)
  ('yi-sang', 'Dimension Shredder',    '차원찢개',     'HE',    'envy',     '차원을 찢는 힘',              '높음'),
  ('yi-sang', 'Fell Bullet',           '흉탄',         'HE',    'pride',    'N사의 흉악한 탄환',           '높음'),

  -- WAW (바브)
  ('yi-sang', 'Sunshower',             '여우비',       'WAW',   'lust',     '해가 떠 있는데 내리는 비',    '매우 높음'),
  ('yi-sang', 'Great Trichiliocosm',   '삼천대세계',   'WAW',   'gloom',    '삼천 개의 세계를 아우르는 힘', '매우 높음');


-- 확인
SELECT 'identities' AS type, count(*) FROM limbus.identities WHERE sinner_id = 'yi-sang'
UNION ALL
SELECT 'ego' AS type, count(*) FROM limbus.ego WHERE sinner_id = 'yi-sang';

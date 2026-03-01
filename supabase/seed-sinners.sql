-- supabase/seed-sinners.sql
-- Supabase Dashboard → SQL Editor에서 실행하세요.
-- limbus 스키마가 없다면 schema.sql 먼저 실행해주세요.

INSERT INTO limbus.sinners (id, name, name_kr, order_num, description, literary_source)
VALUES
  ('yi-sang',     'Yi Sang',    '이상',      1, '날카로운 지성과 분열된 자아를 가진 림버스 컴퍼니의 단장.',             '이상(李箱) — 한국 작가, 1910–1937'),
  ('faust',       'Faust',      '파우스트',  2, '진리를 향한 탐구욕이 강한 뛰어난 의술의 소유자.',                     '파우스트 — 요한 볼프강 폰 괴테'),
  ('don-quixote', 'Don Quixote','돈키호테',  3, '정의와 이상을 위해 싸우는 누구보다 열정적인 기사.',                   '돈키호테 — 미겔 데 세르반테스'),
  ('ryoshu',      'Ryoshu',     '료슈',      4, '고통 속에서 아름다움을 찾는 침착하고 과묵한 검사.',                   '수풀 속(藪の中) — 아쿠타가와 류노스케'),
  ('meursault',   'Meursault',  '뫼르소',    5, '세상에 무관심하지만 압도적인 파괴력을 지닌 이방인.',                  '이방인 — 알베르 카뮈'),
  ('hong-lu',     'Hong Lu',    '홍루',      6, '화려한 배경과 여유로운 태도를 지닌 우아한 귀공자.',                   '홍루몽(紅樓夢) — 조설근'),
  ('heathcliff',  'Heathcliff', '히스클리프',7, '어두운 과거와 집착적인 복수심을 품은 거칠고 냉혹한 남자.',            '폭풍의 언덕 — 에밀리 브론테'),
  ('ishmael',     'Ishmael',    '이스마엘',  8, '강인한 의지와 생존 본능을 지닌 바다를 떠돌던 선원.',                 '모비딕 — 허먼 멜빌'),
  ('rodion',      'Rodion',     '로쟈',      9, '죄책감과 내면의 갈등을 안고 사는 날카로운 지성의 소유자.',             '죄와 벌 — 표도르 도스토옙스키'),
  ('sinclair',    'Sinclair',   '싱클레어', 10, '자아를 찾아 방황하는, 순수하지만 복잡한 갈등을 품은 청년.',           '데미안 — 헤르만 헤세'),
  ('outis',       'Outis',      '오티스',   11, '정체를 숨긴 채 행동하는, 뛰어난 전략적 사고를 지닌 신비로운 인물.',   '오디세이아 — 호메로스'),
  ('gregor',      'Gregor',     '그레고르', 12, '기괴하게 변해버렸지만 인간적인 무언가를 간직한 묵묵한 존재.',         '변신(Die Verwandlung) — 프란츠 카프카')
ON CONFLICT (id) DO UPDATE SET
  name            = EXCLUDED.name,
  name_kr         = EXCLUDED.name_kr,
  order_num       = EXCLUDED.order_num,
  description     = EXCLUDED.description,
  literary_source = EXCLUDED.literary_source;

-- 2026-09-12: Localize.zip의 KR_SeasonTitle / KR_GachaTitle 원문 기준.
-- 발푸르기스 9회는 2026-07-09~2026-07-23; 현재 비활성.
-- https://limbuscompany.wiki.gg/wiki/Event
-- 운영 중인 설정은 덮어쓰지 않는다. 신규 복구 DB에서만 초기값으로 사용한다.
BEGIN;
INSERT INTO limbus.app_config (key, value)
VALUES
  ('current_season', '{"name":"시즌 7","season":7}'::jsonb),
  ('walpurgis_night', '{"active":false,"edition":9}'::jsonb)
ON CONFLICT (key) DO NOTHING;
COMMIT;

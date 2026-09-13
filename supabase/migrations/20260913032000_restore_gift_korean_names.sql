-- Source: KR_EGOgift_lcbcheckup-re.json (game localization export)
-- SHA256: 192ae6ce5a536797315a24f4867198ba8aaad6cd5e24034933fb80c6128a9df5
-- Update only the six verified English fallbacks; retain images and translations.
UPDATE limbus.ego_gifts AS gift
SET name = names.korean
FROM (VALUES
  (9248, 'Spicebush, Glasses, and Mailed Letter', '생강꽃, 안경 그리고 전해진 편지'),
  (9249, 'A Small, Lovely Violin', '조그맣고 근사한 바이올린'),
  (9243, 'Trial Extraction : A.B.S', '시험 추출 : 홍염살'),
  (9244, 'Trial Extraction : Lantern', '시험 추출 : 초롱'),
  (9245, 'Modified Extraction : AEDD', '변형 추출 : AEDD'),
  (9246, 'Someone''s Dropped Employee Card', '누군가 놓쳐버린 사원증')
) AS names(game_id, previous, korean)
WHERE gift.game_id = names.game_id AND gift.name = names.previous;

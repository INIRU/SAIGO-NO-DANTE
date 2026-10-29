-- 순서 3/4 — name_kr과 똑같은 사본 칼럼을 지운다.
-- ★ 사이트 코드 배포(name을 읽지 않음) 뒤 + 동기화 번들 재생성(name·final_result를 쓰지 않음) 뒤에만 적용한다.
--   동기화 프로그램이 아직 쓰는 곳: site-sync/scripts/sync/bootstrap-data.ts 75·136줄, identity-data.ts 249·476·588·4035줄(identities·ego의 name),
--   mirror-dungeon-data.ts 1112·1195·1205·1245·1269줄(레시피 final_result). 먼저 고치지 않으면 반영(apply-extraction)이 "column does not exist"로 멈춘다.
-- 근거(2026-10-29 SELECT): identities.name = name_kr 192/192, ego.name = name_kr 116/116, ego_gift_recipes.final_result = result_name 67/67.
--   sinners.name은 name_kr과 12명 모두 달라(영문 이름) 지우지 않는다.
-- 지우기 전 확인: 서로 다른 값이 하나라도 생겼으면(동기화 프로그램이 한쪽만 갱신한 경우) 멈춘다.
do $$
begin
  if exists (select 1 from limbus.identities where name is distinct from name_kr) then
    raise exception 'identities.name differs from name_kr; reconcile before dropping';
  end if;
  if exists (select 1 from limbus.ego where name is distinct from name_kr) then
    raise exception 'ego.name differs from name_kr; reconcile before dropping';
  end if;
  if exists (select 1 from limbus.ego_gift_recipes where final_result is distinct from result_name) then
    raise exception 'ego_gift_recipes.final_result differs from result_name; reconcile before dropping';
  end if;
end $$;

alter table limbus.identities drop column if exists name;
alter table limbus.ego drop column if exists name;
alter table limbus.ego_gift_recipes drop column if exists final_result;

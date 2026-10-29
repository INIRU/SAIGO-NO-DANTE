-- 순서 1/4 — 새 칼럼만 더한다(모두 nullable). 사이트 코드 배포 전이든 후든, 동기화 프로그램 반영 전이든 후든 언제 적용해도 된다.
-- 값이 없으면 사이트는 지금 방식으로 대체한다(CONTRACT.md "데이터 모양 약속").
--
--   skills.coin_list, ego_skills.coin_list   jsonb  [{"scale","operator":"ADD|SUB|MUL","color","unbreakable"}] 코인 순서대로
--   keyword_meta.abilities                   jsonb  [{"ability","value"}] 게임 buff 데이터의 list 그대로
--   ego_gifts.modifiers                      jsonb  [{"target","value","per","keyword","sinner","source"}] 피해 관련 수치
--   ego_gifts.activation_condition           jsonb  (기존 칼럼) 모양만 확장: type/count/keywords/affiliations/tiers/partial/source
--   ego_gift_recipes.ingredient_ids, result_id   재료·결과 기프트의 game_id (이름 대신)

alter table limbus.skills add column if not exists coin_list jsonb;
alter table limbus.ego_skills add column if not exists coin_list jsonb;
alter table limbus.keyword_meta add column if not exists abilities jsonb;
alter table limbus.ego_gifts add column if not exists modifiers jsonb;
alter table limbus.ego_gift_recipes add column if not exists ingredient_ids integer[];
alter table limbus.ego_gift_recipes add column if not exists result_id integer;

-- 기프트·어시스트 도우미 제안 2개(UPDATE-2026-10-29-gifts-assist.md):
--  * ego_gifts.price: 새 칼럼이 필요 없다. 이미 있고(integer) 464행 모두 채워져 있다(100~999, 2026-10-29 SELECT). 판매 검산은 그대로 읽으면 된다.
--  * identities.skill_condition_list: 혈찬 소모 같은 스킬 조건 이름(게임 한국어). 같은 모양의 skill_keyword_list·unit_keyword_list·
--    association_list가 이미 text[] NOT NULL DEFAULT '{}'이므로 같은 방식으로 둔다. 별도 표+외래 키로 빼지 않는 이유: 조건 이름을
--    담은 부모 표가 없어 가리킬 곳이 없고(키워드 이름과 달리 keyword_meta에 없다), 읽는 쪽이 늘 인격 한 줄과 같이 쓴다.
--    (기본값이 빈 배열이라 동기화 프로그램이 아직 안 써도 사이트는 "조건 없음"으로 읽는다.)
alter table limbus.identities add column if not exists skill_condition_list text[] not null default '{}';

-- 모양 검사: 배열이거나 비어 있어야 한다(동기화 프로그램이 잘못된 모양을 쓰면 그 자리에서 알게 된다).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'skills_coin_list_array') then
    alter table limbus.skills add constraint skills_coin_list_array check (coin_list is null or jsonb_typeof(coin_list) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_skills_coin_list_array') then
    alter table limbus.ego_skills add constraint ego_skills_coin_list_array check (coin_list is null or jsonb_typeof(coin_list) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'keyword_meta_abilities_array') then
    alter table limbus.keyword_meta add constraint keyword_meta_abilities_array check (abilities is null or jsonb_typeof(abilities) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_gifts_modifiers_array') then
    alter table limbus.ego_gifts add constraint ego_gifts_modifiers_array check (modifiers is null or jsonb_typeof(modifiers) = 'array');
  end if;
end $$;

-- 결과 기프트를 game_id로 잇기 위한 유일 키(464개 중 중복·빈칸 0, 2026-10-29 SELECT로 확인). 아래 외래 키가 이 키를 가리킨다.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ego_gifts_game_id_key') then
    alter table limbus.ego_gifts add constraint ego_gifts_game_id_key unique (game_id);
  end if;
end $$;

-- 이름으로 적혀 있던 재료·결과를 game_id로 채운다(이름은 ego_gifts.name이 유일, 순서와 겹침 유지).
-- 재료 175개·결과 67개 모두 이름이 맞는 기프트가 있었다(안 맞는 것 0). 동기화 프로그램이 앞으로 이 칼럼을 직접 쓴다.
update limbus.ego_gift_recipes r
set ingredient_ids = (
      select array_agg(g.game_id order by o.ord)
      from unnest(r.ingredients) with ordinality as o(gift_name, ord)
      join limbus.ego_gifts g on g.name = o.gift_name),
    result_id = (select g.game_id from limbus.ego_gifts g where g.name = r.result_name)
where r.ingredient_ids is null or r.result_id is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ego_gift_recipes_result_id_fkey') then
    alter table limbus.ego_gift_recipes
      add constraint ego_gift_recipes_result_id_fkey foreign key (result_id) references limbus.ego_gifts (game_id) on update cascade;
  end if;
end $$;
create index if not exists ego_gift_recipes_result_id_idx on limbus.ego_gift_recipes (result_id);

-- 인격 화면 도우미 제안(UPDATE-2026-10-29-identity.md): 스킬의 게임 값 3칸, 모두 nullable.
--  * game_skill_id: 게임 스킬 id. 제안 이름은 game_id였으나 ego_skills가 이미 game_skill_id라서 같은 이름으로 맞춘다
--    (동기화 프로그램은 skills.game_skill_id로 쓴다). 지금은 image_id(3,001행 모두 숫자)가 대신 읽혀 iconID가 있는 스킬에서 어긋난다.
--  * skill_tier: 게임 skillTier 1~3. skill_order는 수비 스킬에 4를 쓰므로(수비 3·4, 공격 1~3) 원래 단계를 따로 둔다.
--  * is_variant: 변형 스킬 여부. variant_order는 1~13까지 이어지는 번호라(2026-10-29 SELECT) "1이 아니면 변형"으로 풀 수 없다.
--  skill_order >= 5인 행은 0개다(같은 SELECT): 화면 쪽의 "5 이상은 S3" 추측은 지워도 된다.
alter table limbus.skills add column if not exists game_skill_id integer;
alter table limbus.skills add column if not exists skill_tier smallint;
alter table limbus.skills add column if not exists is_variant boolean;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'skills_skill_tier_check') then
    alter table limbus.skills add constraint skills_skill_tier_check check (skill_tier is null or skill_tier between 1 and 3);
  end if;
end $$;

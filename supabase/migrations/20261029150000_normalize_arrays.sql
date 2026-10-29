-- 순서 4/4 (선택) — 배열에 담긴 기프트·테마 번호를 별도 표 + 외래 키로 푼다.
-- ★ 20261029120000(game_values)과 20261029130000(cleanup) 뒤에 적용한다. 사이트 코드·동기화 프로그램을 고치지 않아도 되는 "확장" 단계다:
--   원래 배열 칼럼(ingredient_ids, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, gift_ids, theme_ids)은 그대로 쓰기 쪽이고
--   (동기화 프로그램·replace_md_event_graph가 지금처럼 쓴다), 아래 표는 그 배열에서 트리거가 자동으로 채운다. CONTRACT 모양은 바뀌지 않으므로 뷰가 필요 없다.
-- 얻는 것: 없는 기프트 번호를 가리키는 값이 들어오면 쓰는 순간 막힌다(외래 키), "이 기프트를 재료로 쓰는 레시피 / 이 기프트가 나오는 테마·이벤트"를
--   배열 전체 훑기 없이 인덱스로 찾는다(테마 풀 10,397 + 전용 261 + 고정 보상 14 + 이벤트 테마 3,820 + 이벤트 기프트 410 + 재료 175개 연결).
-- 위험: 동기화 프로그램이 아직 없는 기프트 번호를 먼저 쓰면(기프트 동기화보다 이벤트 동기화가 먼저 돌 때) 그 쓰기가 외래 키 오류로 멈춘다.
--   지금 데이터는 연결 15,077개 모두 맞는다(안 맞는 것 0, 2026-10-29 SELECT). 동기화 프로그램은 기프트 → 레시피·테마 → 이벤트 순으로 쓰면 된다.
-- 나중에(별도 결정): 읽는 쪽 코드가 이 표를 읽도록 바뀌고 동기화 프로그램이 이 표를 직접 쓰게 되면 원래 배열과 트리거를 지운다.

-- 레시피 재료: 순서(position)가 있다.
create table if not exists limbus.ego_gift_recipe_ingredients (
  recipe_id uuid not null references limbus.ego_gift_recipes (id) on delete cascade,
  position smallint not null,
  gift_game_id integer not null references limbus.ego_gifts (game_id) on update cascade,
  primary key (recipe_id, position)
);
create index if not exists ego_gift_recipe_ingredients_gift_idx on limbus.ego_gift_recipe_ingredients (gift_game_id);

-- 테마의 기프트: role = pool(전체 풀) / specific(테마 전용) / fixed_reward(고정 보상).
create table if not exists limbus.ego_gift_theme_gifts (
  theme_id integer not null references limbus.ego_gift_themes (id) on delete cascade,
  role text not null check (role in ('pool', 'specific', 'fixed_reward')),
  position integer not null,
  gift_game_id integer not null references limbus.ego_gifts (game_id) on update cascade,
  primary key (theme_id, role, position)
);
create index if not exists ego_gift_theme_gifts_gift_idx on limbus.ego_gift_theme_gifts (gift_game_id, role);

-- 이벤트가 주는 기프트 / 이벤트가 나오는 테마.
create table if not exists limbus.md_event_gifts (
  event_id integer not null references limbus.md_events (id) on delete cascade,
  position smallint not null,
  gift_game_id integer not null references limbus.ego_gifts (game_id) on update cascade,
  primary key (event_id, position)
);
create index if not exists md_event_gifts_gift_idx on limbus.md_event_gifts (gift_game_id);

create table if not exists limbus.md_event_themes (
  event_id integer not null references limbus.md_events (id) on delete cascade,
  position integer not null,
  theme_id integer not null references limbus.ego_gift_themes (id) on update cascade,
  primary key (event_id, position)
);
create index if not exists md_event_themes_theme_idx on limbus.md_event_themes (theme_id);

-- 읽기는 누구나, 쓰기는 트리거(서비스 키로 부모를 쓸 때)만.
do $$
declare t text;
begin
  foreach t in array array['ego_gift_recipe_ingredients', 'ego_gift_theme_gifts', 'md_event_gifts', 'md_event_themes'] loop
    execute format('alter table limbus.%I enable row level security', t);
    execute format('drop policy if exists %I on limbus.%I', t || '_public_read', t);
    execute format('create policy %I on limbus.%I for select using (true)', t || '_public_read', t);
    execute format('revoke insert, update, delete, truncate on limbus.%I from anon, authenticated', t);
  end loop;
end $$;

-- 배열 → 연결 표. 부모 행을 쓸 때마다 그 부모의 연결만 지우고 다시 넣는다.
create or replace function limbus.sync_recipe_ingredients() returns trigger language plpgsql set search_path = '' as $$
begin
  delete from limbus.ego_gift_recipe_ingredients where recipe_id = new.id;
  insert into limbus.ego_gift_recipe_ingredients (recipe_id, position, gift_game_id)
  select new.id, t.ord::smallint, t.gift from unnest(coalesce(new.ingredient_ids, '{}')) with ordinality as t(gift, ord);
  return new;
end $$;

create or replace function limbus.sync_theme_gifts() returns trigger language plpgsql set search_path = '' as $$
begin
  delete from limbus.ego_gift_theme_gifts where theme_id = new.id;
  insert into limbus.ego_gift_theme_gifts (theme_id, role, position, gift_game_id)
  select new.id, 'pool', t.ord::integer, t.gift from unnest(coalesce(new.ego_gift_ids, '{}')) with ordinality as t(gift, ord)
  union all
  select new.id, 'specific', t.ord::integer, t.gift from unnest(coalesce(new.specific_ego_gift_ids, '{}')) with ordinality as t(gift, ord)
  union all
  select new.id, 'fixed_reward', t.ord::integer, t.gift from unnest(coalesce(new.fixed_reward_gift_ids, '{}')) with ordinality as t(gift, ord);
  return new;
end $$;

create or replace function limbus.sync_event_links() returns trigger language plpgsql set search_path = '' as $$
begin
  delete from limbus.md_event_gifts where event_id = new.id;
  insert into limbus.md_event_gifts (event_id, position, gift_game_id)
  select new.id, t.ord::smallint, t.gift from unnest(coalesce(new.gift_ids, '{}')) with ordinality as t(gift, ord);
  delete from limbus.md_event_themes where event_id = new.id;
  insert into limbus.md_event_themes (event_id, position, theme_id)
  select new.id, t.ord::integer, t.theme from unnest(coalesce(new.theme_ids, '{}')) with ordinality as t(theme, ord);
  return new;
end $$;

drop trigger if exists ego_gift_recipes_sync_ingredients on limbus.ego_gift_recipes;
create trigger ego_gift_recipes_sync_ingredients after insert or update of ingredient_ids on limbus.ego_gift_recipes
  for each row execute function limbus.sync_recipe_ingredients();

drop trigger if exists ego_gift_themes_sync_gifts on limbus.ego_gift_themes;
create trigger ego_gift_themes_sync_gifts after insert or update of ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids on limbus.ego_gift_themes
  for each row execute function limbus.sync_theme_gifts();

drop trigger if exists md_events_sync_links on limbus.md_events;
create trigger md_events_sync_links after insert or update of gift_ids, theme_ids on limbus.md_events
  for each row execute function limbus.sync_event_links();

-- 지금 있는 배열을 한 번 옮긴다. 아래 갱신은 값을 바꾸지 않고 트리거만 깨운다(SET에 이름이 있으면 같은 값이어도 열 지정 트리거가 돈다).
update limbus.ego_gift_recipes set ingredient_ids = ingredient_ids where ingredient_ids is not null;
update limbus.ego_gift_themes set ego_gift_ids = ego_gift_ids;
update limbus.md_events set gift_ids = gift_ids;

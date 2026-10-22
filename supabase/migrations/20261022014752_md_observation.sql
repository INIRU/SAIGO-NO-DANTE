-- 거울 던전 시작 관측: 시즌별 관측 가능한 E.G.O 기프트와 별빛 비용.
-- 추출 도구 site-sync(syncObservation)가 시즌마다 한 행을 쓴다. 설계: limbus-asset-extractor/site-sync/docs/md-observation.md
create table limbus.md_observation (
  mirror_dungeon_id integer primary key,
  source_file text not null,
  keyword_groups jsonb not null,
  gift_ids integer[] not null,
  costs jsonb not null,
  unobservable_gift_ids integer[] not null default '{}'
);
comment on table limbus.md_observation is '거울 던전 시작 관측: 시즌별 관측 가능한 E.G.O 기프트와 별빛 비용 (mirror-dungeon-egogift-observation-data-md<N>)';
comment on column limbus.md_observation.mirror_dungeon_id is '시즌 (8 = md8)';
comment on column limbus.md_observation.source_file is '읽은 complete-data 파일 이름';
comment on column limbus.md_observation.keyword_groups is '[{"keyword":"None","gift_ids":[...]}, ...] 게임의 탭 순서';
comment on column limbus.md_observation.gift_ids is '관측 가능한 기프트 전부(정렬). ego_gifts.game_id';
comment on column limbus.md_observation.costs is '[{"count":1,"starlight":70}, ...]';
alter table limbus.md_observation enable row level security;
create policy md_observation_public_read on limbus.md_observation for select using (true);

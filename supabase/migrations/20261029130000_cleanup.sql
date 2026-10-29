-- 순서 2/4 — 정리(drop)·무결성(NOT NULL·UNIQUE·CHECK·외래 키)·인덱스·최고 동기화 뷰.
-- ★ 사이트 코드 배포 뒤에 적용한다. 배포 전에 적용하면 이 칼럼을 아직 읽는 옛 코드가 400 오류를 낸다.
--   (동기화 프로그램은 여기서 지우는 칼럼을 읽거나 쓰지 않는다: site-sync/scripts/sync 확인. 동기화 프로그램 반영 뒤가 필요한 것은 20261029140000_drop_name_copies.sql.)
-- 근거: 2026-10-29 실제 DB를 SELECT로만 센 결과(행 수, 빈칸 수, 중복, pg_stat_user_indexes). 아래 숫자는 모두 그 시점 값이다.
-- ★ 이 마이그레이션 전에 찍은 백업(extraction-restore의 JSON)은 지워진 칼럼을 담고 있어 그대로 복원할 수 없다.
-- 인덱스는 표가 작아(가장 큰 skills 3,001행) 잠금이 순간이므로 CONCURRENTLY 없이 만든다(마이그레이션은 트랜잭션 안에서 돈다).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 바로 지워도 되는 것
-- ─────────────────────────────────────────────────────────────────────────────
-- 은퇴 스키마: 표 11개 모두 0행 + 뷰 1(identity_sentiment_trend) + 함수. 롤백 스크립트(supabase/rollback/retire_unused_features.sql)도 함께 지운다.
drop schema if exists limbus_retired cascade;

-- 덱 코드: 145행 모두 빈칸. 화면의 덱 코드는 덱 내용으로 계산한 값이다(app/api/decks/[id]/route.ts).
alter table limbus.decks drop column if exists deck_code;
-- 기프트 첫 등장: 지우는 마이그레이션(20260504_...)은 있었으나 실제 DB에는 적용되지 않았다. 464행 모두 빈칸.
alter table limbus.ego_gifts drop column if exists first_appearance;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 코드를 고친 뒤 지우는 것(사이트 배포 뒤 적용): 전부 빈칸이다
-- ─────────────────────────────────────────────────────────────────────────────
alter table limbus.ego drop column if exists description;            -- 116행 모두 빈칸
alter table limbus.ego drop column if exists corrosion_risk;         -- 116행 모두 빈칸
alter table limbus.ego drop column if exists obtaining_method;       -- 116행 모두 빈칸
alter table limbus.ego drop column if exists obtaining_method_en;
alter table limbus.ego drop column if exists obtaining_method_jp;
alter table limbus.ego_gifts drop column if exists related;          -- 464행 모두 빈칸
alter table limbus.ego_gifts drop column if exists acquisition;      -- 464행 모두 빈칸
alter table limbus.keyword_meta drop column if exists sin_affinity;  -- 516행 모두 빈칸
alter table limbus.audit_logs drop column if exists ip;              -- 1,171행 모두 빈칸. lib/audit.ts가 더는 넘기지 않는다
alter table limbus.audit_logs drop column if exists country;

-- profiles.last_ip: 함수가 계속 NULL을 쓰고 있었다(IP 원본은 저장하지 않고 해시·마스킹만 둔다). 함수에서 그 줄을 먼저 뺀다.
create or replace function limbus.record_profile_activity(
  user_email text,
  request_ip_hash text default null::text,
  request_ip_masked text default null::text,
  request_user_agent_hash text default null::text,
  request_country text default null::text,
  request_device_hash text default null::text
) returns uuid
language plpgsql
security definer
set search_path to 'limbus', 'public'
as $function$
DECLARE
  recorded_profile_id UUID;
  normalized_ip_hash TEXT := NULLIF(request_ip_hash, '');
  normalized_ip_masked TEXT := NULLIF(request_ip_masked, '');
  normalized_user_agent_hash TEXT := NULLIF(request_user_agent_hash, '');
  normalized_country TEXT := NULLIF(upper(request_country), '');
  normalized_device_hash TEXT := NULLIF(request_device_hash, '');
  device_matched_profile_ids UUID[] := '{}';
  combined_matched_profile_ids UUID[] := '{}';
  matched_profile_ids UUID[] := '{}';
  reasons JSONB := '[]'::jsonb;
  strong_snapshot JSONB;
BEGIN
  UPDATE limbus.profiles p
  SET
    last_seen_at = now(),
    last_ip_hash = COALESCE(normalized_ip_hash, p.last_ip_hash),
    last_ip_masked = COALESCE(normalized_ip_masked, p.last_ip_masked),
    last_user_agent_hash = COALESCE(normalized_user_agent_hash, p.last_user_agent_hash),
    last_device_hash = COALESCE(normalized_device_hash, p.last_device_hash),
    last_country = COALESCE(normalized_country, p.last_country)
  FROM auth.users u
  WHERE p.id = u.id
    AND u.email = user_email
  RETURNING p.id INTO recorded_profile_id;

  IF recorded_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO limbus.profile_access_signals (
    profile_id,
    seen_at,
    ip_hash,
    ip_masked,
    user_agent_hash,
    device_hash,
    country
  )
  VALUES (
    recorded_profile_id,
    now(),
    normalized_ip_hash,
    normalized_ip_masked,
    normalized_user_agent_hash,
    normalized_device_hash,
    normalized_country
  );

  DELETE FROM limbus.profile_access_signals stale
  WHERE stale.profile_id = recorded_profile_id
    AND stale.id NOT IN (
      SELECT recent.id
      FROM limbus.profile_access_signals recent
      WHERE recent.profile_id = recorded_profile_id
      ORDER BY recent.seen_at DESC, recent.created_at DESC, recent.id DESC
      LIMIT 5
    );

  IF normalized_device_hash IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT matched.profile_id), '{}'::uuid[])
    INTO device_matched_profile_ids
    FROM (
      SELECT p.id AS profile_id
      FROM limbus.profiles p
      WHERE p.id <> recorded_profile_id
        AND p.last_device_hash = normalized_device_hash
      UNION
      SELECT s.profile_id
      FROM limbus.profile_access_signals s
      WHERE s.profile_id <> recorded_profile_id
        AND s.device_hash = normalized_device_hash
    ) matched;

    IF array_length(device_matched_profile_ids, 1) IS NOT NULL THEN
      reasons := reasons || jsonb_build_array(jsonb_build_object(
        'type', 'device',
        'device_hash_fingerprint', concat(left(normalized_device_hash, 6), '...', right(normalized_device_hash, 4)),
        'matched_profile_ids', to_jsonb(device_matched_profile_ids)
      ));
    END IF;
  END IF;

  IF normalized_ip_hash IS NOT NULL AND normalized_user_agent_hash IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT matched.profile_id), '{}'::uuid[])
    INTO combined_matched_profile_ids
    FROM (
      SELECT p.id AS profile_id
      FROM limbus.profiles p
      WHERE p.id <> recorded_profile_id
        AND p.last_ip_hash = normalized_ip_hash
        AND p.last_user_agent_hash = normalized_user_agent_hash
      UNION
      SELECT s.profile_id
      FROM limbus.profile_access_signals s
      WHERE s.profile_id <> recorded_profile_id
        AND s.ip_hash = normalized_ip_hash
        AND s.user_agent_hash = normalized_user_agent_hash
    ) matched;

    IF array_length(combined_matched_profile_ids, 1) IS NOT NULL THEN
      reasons := reasons || jsonb_build_array(jsonb_build_object(
        'type', 'ip_user_agent',
        'ip_hash_fingerprint', concat(left(normalized_ip_hash, 6), '...', right(normalized_ip_hash, 4)),
        'user_agent_hash_fingerprint', concat(left(normalized_user_agent_hash, 6), '...', right(normalized_user_agent_hash, 4)),
        'matched_profile_ids', to_jsonb(combined_matched_profile_ids)
      ));
    END IF;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT profile_id), '{}'::uuid[])
  INTO matched_profile_ids
  FROM (
    SELECT unnest(device_matched_profile_ids) AS profile_id
    UNION
    SELECT unnest(combined_matched_profile_ids) AS profile_id
  ) merged;

  IF array_length(matched_profile_ids, 1) IS NOT NULL THEN
    strong_snapshot := jsonb_build_object(
      'schema_version', 1,
      'detected_at', now(),
      'source', 'record_profile_activity',
      'profile_id', recorded_profile_id,
      'signal_grade', 'strong',
      'matched_profile_ids', to_jsonb(matched_profile_ids),
      'reasons', reasons
    );

    INSERT INTO limbus.profile_duplicate_signal_events (
      profile_id,
      signal_grade,
      matched_profile_ids,
      match_snapshot,
      last_detected_at,
      updated_at
    )
    VALUES (
      recorded_profile_id,
      'strong',
      matched_profile_ids,
      strong_snapshot,
      now(),
      now()
    )
    ON CONFLICT (profile_id, signal_grade) DO UPDATE
    SET
      matched_profile_ids = (
        SELECT COALESCE(array_agg(DISTINCT merged_profile_id), '{}'::uuid[])
        FROM unnest(limbus.profile_duplicate_signal_events.matched_profile_ids || EXCLUDED.matched_profile_ids) AS merged(merged_profile_id)
      ),
      match_snapshot = EXCLUDED.match_snapshot,
      last_detected_at = EXCLUDED.last_detected_at,
      updated_at = EXCLUDED.updated_at;

    INSERT INTO limbus.profile_duplicate_signal_events (
      profile_id,
      signal_grade,
      matched_profile_ids,
      match_snapshot,
      last_detected_at,
      updated_at
    )
    SELECT
      matched_profile_id,
      'strong',
      ARRAY[recorded_profile_id]::uuid[],
      jsonb_build_object(
        'schema_version', 1,
        'detected_at', now(),
        'source', 'record_profile_activity',
        'profile_id', matched_profile_id,
        'signal_grade', 'strong',
        'matched_profile_ids', jsonb_build_array(recorded_profile_id),
        'counterparty_profile_id', recorded_profile_id,
        'reasons', reasons
      ),
      now(),
      now()
    FROM unnest(matched_profile_ids) AS matched(matched_profile_id)
    ON CONFLICT (profile_id, signal_grade) DO UPDATE
    SET
      matched_profile_ids = (
        SELECT COALESCE(array_agg(DISTINCT merged_profile_id), '{}'::uuid[])
        FROM unnest(limbus.profile_duplicate_signal_events.matched_profile_ids || EXCLUDED.matched_profile_ids) AS merged(merged_profile_id)
      ),
      match_snapshot = EXCLUDED.match_snapshot,
      last_detected_at = EXCLUDED.last_detected_at,
      updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN recorded_profile_id;
END;
$function$;

alter table limbus.profiles drop column if exists last_ip;          -- 579행 모두 빈칸

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 빠진 NOT NULL · UNIQUE · CHECK · 외래 키 (현재 데이터가 모두 통과함을 SELECT로 확인한 것만)
-- ─────────────────────────────────────────────────────────────────────────────
-- 빈칸이 하나도 없고 기본값이 이미 있는 칸.
alter table limbus.decks alter column vote_count set not null;      -- 빈칸 0
alter table limbus.decks alter column view_count set not null;
alter table limbus.decks alter column comment_count set not null;
alter table limbus.decks alter column created_at set not null;
alter table limbus.decks alter column tags set not null;
alter table limbus.deck_comments alter column deck_id set not null; -- 덱 없는 댓글 0
-- 인격·E.G.O·스킬·패시브는 주인 없이 존재할 수 없다(빈칸 0).
alter table limbus.skills alter column identity_id set not null;
alter table limbus.passives alter column identity_id set not null;
alter table limbus.identities alter column sinner_id set not null;
alter table limbus.identities alter column name_kr set not null;
alter table limbus.identities alter column game_id set not null;
alter table limbus.ego alter column sinner_id set not null;
alter table limbus.ego alter column name_kr set not null;
alter table limbus.ego alter column game_id set not null;
alter table limbus.ego_gifts alter column game_id set not null;

do $$
begin
  -- 게임 id는 하나뿐이다(192·116개 중 중복 0). 기프트는 120000에서 이미 걸었다.
  if not exists (select 1 from pg_constraint where conname = 'identities_game_id_key') then
    alter table limbus.identities add constraint identities_game_id_key unique (game_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_game_id_key') then
    alter table limbus.ego add constraint ego_game_id_key unique (game_id);
  end if;

  -- 값의 범위. 지금 데이터가 전부 이 안에 있다. (E.G.O 등급 ALEPH는 아직 없지만 게임에 있는 등급이라 허용한다.)
  if not exists (select 1 from pg_constraint where conname = 'ego_grade_check') then
    alter table limbus.ego add constraint ego_grade_check check (grade in ('ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_gifts_grade_check') then
    alter table limbus.ego_gifts add constraint ego_gifts_grade_check check (grade in ('1', '2', '3', '4', '5', 'EX'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'identities_rarity_check') then
    alter table limbus.identities add constraint identities_rarity_check check (rarity between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_sin_affinity_check') then
    alter table limbus.ego add constraint ego_sin_affinity_check
      check (sin_affinity is null or sin_affinity in ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'skills_sin_affinity_check') then
    alter table limbus.skills add constraint skills_sin_affinity_check
      check (sin_affinity is null or sin_affinity in ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_skills_sin_affinity_check') then
    alter table limbus.ego_skills add constraint ego_skills_sin_affinity_check
      check (sin_affinity is null or sin_affinity in ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'passives_sin_affinity_check') then
    alter table limbus.passives add constraint passives_sin_affinity_check
      check (sin_affinity is null or sin_affinity in ('wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'passives_passive_type_check') then
    alter table limbus.passives add constraint passives_passive_type_check check (passive_type in ('battle', 'support'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'skills_skill_type_check') then
    alter table limbus.skills add constraint skills_skill_type_check
      check (skill_type in ('slash', 'pierce', 'blunt', 'evade', 'defense', 'counter'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ego_skills_category_check') then
    alter table limbus.ego_skills add constraint ego_skills_category_check check (category is null or category in ('awakening', 'corrosion'));
  end if;

  -- 합성 기프트의 변환 대상(3개 모두 존재). 기프트가 지워져도 변환 칸만 비운다.
  if not exists (select 1 from pg_constraint where conname = 'ego_gifts_convert_to_fkey') then
    alter table limbus.ego_gifts add constraint ego_gifts_convert_to_fkey
      foreign key (convert_to) references limbus.ego_gifts (game_id) on update cascade on delete set null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 인덱스
-- ─────────────────────────────────────────────────────────────────────────────
-- 지금 있는 것 중 필요 없는 것: 같은 것이 둘이거나(기본 키와 같은 legal_docs_type_lang_key, 새 UNIQUE와 같은 idx_ego_gifts_game_id),
-- 한 번도 안 쓰였는데 크기만 큰 것(16행에 896kB인 profile_duplicate_signal_events의 jsonb GIN; 코드에 @> 조회 없음).
drop index if exists limbus.legal_docs_type_lang_key;
drop index if exists limbus.idx_ego_gifts_game_id;
drop index if exists limbus.idx_profile_duplicate_signal_events_snapshot_gin;

-- 외래 키만 있고 인덱스가 없어, "내가 한 투표·북마크·댓글"과 사용자 삭제 때의 연쇄 삭제가 표 전체를 훑던 곳.
create index if not exists deck_votes_user_id_idx on limbus.deck_votes (user_id);
create index if not exists deck_bookmarks_user_id_idx on limbus.deck_bookmarks (user_id);
create index if not exists deck_comments_user_id_idx on limbus.deck_comments (user_id);
create index if not exists md_plan_votes_user_id_idx on limbus.md_plan_votes (user_id);
create index if not exists md_plan_comments_user_id_idx on limbus.md_plan_comments (user_id);
create index if not exists deck_egos_ego_id_idx on limbus.deck_egos (ego_id);       -- "이 E.G.O를 쓴 덱"
create index if not exists audit_logs_actor_id_idx on limbus.audit_logs (actor_id);
-- 스킬 영상 id로 찾는 곳(motion 목록·상세): 지금은 3,001행 전체를 훑는다(EXPLAIN: Seq Scan, 1,005 종류).
create index if not exists skills_image_id_idx on limbus.skills (image_id);
-- 덱 정렬(lang + 투표/최신) 인덱스는 만들지 않는다: decks 145행에서는 계획기가 표 전체 훑기+정렬을 택한다(EXPLAIN 확인).
-- 덱이 5천 개를 넘으면 (lang, created_at desc, id desc)와 (lang, vote_count desc, created_at desc, id desc)를 추가한다.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 최고 동기화 스킬·패시브 뷰 (메타·덱 빌더·플래너·모션이 모든 동기화 단계를 읽고 JS로 거르던 낭비를 DB에서 거른다)
--    스킬 3,001행 → 876행, 패시브 1,401행 → 494행. 슬롯(인격 + 스킬 번호 / 패시브 종류·번호)마다 가장 높은 동기화 단계.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view limbus.skills_max_uptie with (security_invoker = true) as
select s.*
from limbus.skills s
where s.uptie_level = (
  select max(m.uptie_level) from limbus.skills m
  where m.identity_id = s.identity_id and m.skill_order = s.skill_order
);

create or replace view limbus.passives_max_uptie with (security_invoker = true) as
select p.*
from limbus.passives p
where p.uptie_level = (
  select max(m.uptie_level) from limbus.passives m
  where m.identity_id = p.identity_id and m.passive_type = p.passive_type and m.passive_order is not distinct from p.passive_order
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 게임 값 표는 서비스 키로만 쓴다: RLS가 이미 막고 있지만(쓰기 정책 0) anon·authenticated가 쓰기 권한을 쥐고 있어 권한도 걷는다.
--    (20260928231000_lock_public_writes.sql와 같은 방식. 읽기 정책은 그대로.)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'sinners', 'identities', 'passives', 'ego', 'ego_skills', 'ego_passives', 'keyword_meta',
    'ego_gifts', 'ego_gift_recipes', 'ego_gift_themes', 'md_events', 'md_event_choices', 'md_observation'
  ] loop
    execute format('revoke insert, update, delete, truncate on limbus.%I from anon, authenticated', t);
  end loop;
end $$;

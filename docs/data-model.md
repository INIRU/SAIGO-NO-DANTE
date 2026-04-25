# 데이터 모델 (DB Schema)

SAIGO NO DANTE Supabase PostgreSQL `limbus` 스키마 (51 테이블). **2026-04-25 tier-list ratings migration 기준.**

> Supabase Dashboard > Settings > API > Extra search path에 `limbus`가 추가되어야 한다.

---

## 테이블 목록

### 게임 데이터 (읽기 전용, Admin만 쓰기)

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `sinners` | 8 | 12명의 수감자 기본 정보 |
| `identities` | 28 | 인격 카드 |
| `skills` | 20 | 인격 스킬 (업타이 3/4) |
| `passives` | 14 | 인격 패시브 |
| `ego` | 28 | E.G.O |
| `ego_skills` | 19 | E.G.O 스킬 (각성/침식, 해석 3/4) |
| `keyword_meta` | 10 | 키워드 사전 (아이콘, 설명, 죄악 속성) |
| `panic_types` | 7 | 패닉 유형 |
| `mental_condition_templates` | 7 | 정신력 조건 템플릿 |
| `identity_sanity_conditions` | 6 | 인격별 정신력 조건 |

### 거울 던전

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `ego_gifts` | 29 | EGO 기프트 |
| `ego_gift_themes` | 16 | 테마팩 |
| `ego_gift_recipes` | 6 | 기프트 조합 레시피 |
| `md_events` | 15 | 거울 던전 이벤트 (신 설계) |
| `md_event_choices` | 10 | 이벤트 선택지 (신 설계) |
| `md_plans` | 16 | 거울 던전 플래너 공유 |
| `md_plan_comments` | 6 | 플래너 댓글 |
| `md_plan_votes` | 2 | 플래너 좋아요 |
| `mirror_dungeon_events` | 10 | ⚠️ 구 설계 이벤트 — deprecate 예정 |

### 사용자/커뮤니티

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `profiles` | 9 | 유저 프로필 (auth.users 확장) |
| `decks` | 13 | 덱 편성 |
| `deck_identities` | 7 | 덱-인격 편성 |
| `deck_egos` | 4 | 덱-EGO 편성 |
| `deck_votes` | 2 | 덱 좋아요 |
| `deck_bookmarks` | 3 | 덱 북마크 |
| `deck_comments` | 6 | 덱 댓글 |
| `identity_reviews` | 6 | 인격 리뷰 (개추/비추) |
| `tier_ratings` | 8 | 티어표 평가/댓글 |
| `tier_rating_reports` | 6 | 티어표 평가 댓글 신고 |
| `identity_guides` | 8 | 인격 운영법 가이드 |
| `identity_sentiment` | 16 | 인격 커뮤니티 감성 분석 |
| `identity_sentiment_trend` | 7 | 감성 트렌드 집계 (뷰) |
| `identity_ai_summaries` | 5 | 인격별 AI 요약 |
| `tier_list` | 6 | 티어 리스트 |

### 스토리

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `story_characters` | 9 | 스토리 등장인물 |
| `story_episodes` | 8 | 스토리 에피소드 |
| `story_lines` | 14 | 스토리 대사/연출 데이터 |

### 시스템/관리

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `announcements` | 6 | 공지사항 |
| `site_maintenance` | 9 | 페이지별 점검 상태 |
| `audit_logs` | 7 | 관리자 활동 로그 |
| `game_translations` | 7 | 게임 데이터 번역 오버레이 (EN/JP) |
| `ai_summaries` | 9 | AI 요약 캐시 (다국어) |
| `app_config` | 3 | 앱 설정 키-값 저장소 |
| `legal_docs` | 6 | 법적 문서 (이용약관/개인정보처리방침) |
| `chat_logs` | 3 | 채팅 기록 |

### Discord 봇 연동

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `guild_settings` | 6 | Discord 서버별 봇 설정 |
| `guild_feed_history` | 6 | Discord 봇 피드 발송 이력 |
| `feed_tracker` | 4 | 외부 피드 마지막 체크 상태 (Steam, Twitter) |
| `tickets` | 9 | Discord 티켓 (문의/신고) |
| `warnings` | 6 | Discord 경고 기록 |

### 백업/정리 후보

| 테이블 | 컬럼 수 | 설명 |
|--------|---------|------|
| `_md_events_img_backup` | 2 | ⚠️ 백업 테이블 — DROP 검토 |

---

## 중복/정리 후보 (⚠️)

1. **`mirror_dungeon_events` (구 설계) vs `md_events` + `md_event_choices` (신 설계)**
   - `mirror_dungeon_events`: `options` JSONB에 선택지와 결과를 중첩 저장, `parent_id` self-ref로 연쇄 이벤트 표현
   - `md_events` + `md_event_choices`: 이벤트/선택지를 분리된 테이블로 정규화, `variant_of` self-ref
   - **권장**: `md_events`/`md_event_choices`로 전면 이관 후 `mirror_dungeon_events` DROP
   
2. **`_md_events_img_backup`** — `id`, `image_url` 2컬럼짜리 백업 잔재. 검증 후 DROP.

---

## RLS 상태

RLS가 비활성화된 테이블 — 리스크 평가:

| 테이블 | RLS | 리스크 | 비고 |
|--------|-----|--------|------|
| `_md_events_img_backup` | ❌ | 낮음 | DROP 예정 |
| `deck_identities` | ❌ | **높음** | 덱 편성 데이터 무방비 노출 |
| `guild_feed_history` | ❌ | 낮음 | Discord 봇 전용, 내부 데이터 |
| `identity_sanity_conditions` | ❌ | 낮음 | 읽기 전용 게임 데이터 |
| `identity_sentiment` | ❌ | 중간 | 사용자 연관 감성 데이터 |
| `legal_docs` | ❌ | 없음 | 공개 문서, 의도적 노출 |
| `mental_condition_templates` | ❌ | 낮음 | 읽기 전용 게임 데이터 |
| `mirror_dungeon_events` | ❌ | 낮음 | Deprecate 예정 |
| `panic_types` | ❌ | 낮음 | 읽기 전용 게임 데이터 |
| `skills` | ❌ | **높음** | 인격 스킬 무방비 쓰기 가능 |

---

## 상세 스키마

### sinners (수감자)

12명의 수감자 기본 데이터.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | TEXT | PK | 슬러그 (`yi-sang`, `faust` 등) |
| `name` | TEXT | NOT NULL | 영문 이름 |
| `name_kr` | TEXT | NOT NULL | 한글 이름 |
| `description` | TEXT | | 설명 |
| `literary_source` | TEXT | | 문학 원전 |
| `order_num` | INT | | 표시 순서 (1-12) |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |

- RLS: 모든 사용자 읽기 가능

---

### identities (인격)

인격 카드 정보. 스킬/패시브/정신력 조건은 별도 테이블에서 FK로 연결.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `sinner_id` | TEXT | FK → sinners(id) | 소속 수감자 |
| `name` | TEXT | NOT NULL | 인격명 (한글) |
| `name_kr` | TEXT | | 한글명 (별칭/보조용) |
| `tier` | INT | DEFAULT 1 | 해금 티어 (1-4) |
| `hp` | INT | | 체력 |
| `speed_min` | INT | | 최소 속도 |
| `speed_max` | INT | | 최대 속도 |
| `def_level` | INT | | 방어 레벨 |
| `keywords` | TEXT[] | | 키워드 배열 |
| `rarity` | INT | NOT NULL, DEFAULT 1 | 등급 (1, 2, 3) |
| `game_id` | TEXT | | 게임 내부 ID (이미지 파일 접두사) |
| `folder_name` | TEXT | | Supabase Storage 영문 폴더명 |
| `affiliation` | TEXT | | 소속 (한글: `LCB`, `세븐 협회` 등) |
| `panic_type` | INT | FK → panic_types(id) | 패닉 유형 ID |
| `quote` | TEXT | | 인격 대사 |
| `slash_res` | TEXT | | 참격 내성 |
| `pierce_res` | TEXT | | 관통 내성 |
| `blunt_res` | TEXT | | 타격 내성 |
| `release_date` | TEXT | | 출시일 |
| `acquisition` | TEXT | | 획득 방법 텍스트 |
| `acquisition_info` | JSONB | | 획득 정보 구조화 데이터 |
| `break_section` | INT[] | | 브레이크 구간 |
| `base_hp` | NUMERIC | | 기본 HP |
| `hp_per_level` | NUMERIC | | 레벨당 HP |
| `bg_image_url` | TEXT | | 배경 이미지 URL |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |

**acquisition_info JSONB 구조:**
```jsonc
{
  "type": "default" | "standard" | "event" | "walpurgis" | "attendance",
  "release_season": 3,
  "fragment_cost": 400,         // 자아 파편 교환 비용 (null이면 교환 불가)
  "gacha": "always" | "seasonal" | "walpurgis" | "none",
  "gacha_from_season": 4,       // 상시 추출 가능 시즌 (optional)
  "exchange_from_season": 4,    // 교환 가능 시즌 (optional)
  "walpurgis_edition": 1,       // 발푸르기스 에디션 (optional)
  "event_name": "...",          // 이벤트명 (optional)
  "event_currency": "...",      // 이벤트 재화 (optional)
  "event_cost": 100             // 이벤트 비용 (optional)
}
```

- RLS: 모든 사용자 읽기 가능
- 인덱스: `sinner_id`
- sync: `scripts/sync-identities.mjs`

---

### skills (스킬)

인격 스킬. 같은 스킬이 업타이 3과 4에서 각각 별도 row로 저장된다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | FK → identities(id) ON DELETE CASCADE | 소속 인격 |
| `name` | TEXT | NOT NULL | 스킬명 |
| `skill_type` | TEXT | | `attack`, `defense`, `counter`, `evade` |
| `sin_affinity` | TEXT | | 죄악 속성 |
| `coins` | INT | DEFAULT 1 | 코인 수 |
| `base_power` | INT | | 기본 위력 |
| `coin_power` | INT | | 코인 위력 |
| `description` | TEXT | | 스킬 설명 (코인 효과 포함) |
| `skill_order` | INT | | 스킬 슬롯 (1, 2, 3) |
| `atk_weight` | INT | DEFAULT 1 | 공격 가중치 |
| `offense_level` | INT | DEFAULT 60 | 공격 레벨 (프론트엔드에서 -60 보정값 표시) |
| `quantity` | INT | | 수량 |
| `uptie_level` | INT | DEFAULT 3 | 동기화 단계 (3 또는 4) |
| `variant_order` | INT | DEFAULT 1 | 삽입 순서 |
| `defense_level` | INT | | 방어 레벨 |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `description_en` | TEXT | | 영문 설명 (i18n) |
| `description_jp` | TEXT | | 일본어 설명 (i18n) |

- RLS: **비활성화** (⚠️ 보안 갭)
- sync: `scripts/sync-skills.mjs`

---

### passives (패시브)

인격 패시브 스킬.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | FK → identities(id) ON DELETE CASCADE | 소속 인격 |
| `passive_type` | TEXT | NOT NULL | `battle` 또는 `support` |
| `name` | TEXT | NOT NULL | 패시브명 |
| `sin_affinity` | TEXT | | 발동 조건 죄악 타입 |
| `sin_count` | INT | | 필요 자원 수 |
| `active_cond` | TEXT | | 발동 조건 유형 (`공명`, `보유` 등) |
| `description` | TEXT | | 패시브 설명 |
| `passive_order` | INT | DEFAULT 1 | 같은 타입 내 순서 |
| `uptie_level` | INT | DEFAULT 3 | 동기화 단계 (3 또는 4) |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `description_en` | TEXT | | 영문 설명 (i18n) |
| `description_jp` | TEXT | | 일본어 설명 (i18n) |

- RLS: 모든 사용자 읽기 가능
- 인덱스: `identity_id`

---

### ego (E.G.O)

E.G.O 장비 정보.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `sinner_id` | TEXT | FK → sinners(id) | 소속 수감자 |
| `name` | TEXT | NOT NULL | 인게임 이름 (한글) |
| `name_kr` | TEXT | | 한글명 (보조) |
| `grade` | TEXT | | `ZAYIN`, `TETH`, `HE`, `WAW`, `ALEPH` |
| `sin_affinity` | TEXT | | 죄악 속성 |
| `description` | TEXT | | 설명 |
| `corrosion_risk` | TEXT | | 침식 위험도 |
| `folder_name` | TEXT | | 로컬 폴더명 (이미지 경로) |
| `image_url` | TEXT | | awaken_profile.webp 전체 URL |
| `passive_name` | TEXT | | 패시브 이름 |
| `passive_content` | TEXT | | 패시브 내용 |
| `ego_skills` | JSONB | | 각성 스킬 구조 (레거시) |
| `ego_cor_skills` | JSONB | | 침식 스킬 구조 (레거시) |
| `resistance` | TEXT[] | | 죄악 내성 배열 (7개) |
| `cost` | INT[] | | 죄악 코스트 배열 (7개) |
| `keywords` | TEXT[] | | 전용 키워드 |
| `obtaining_method` | TEXT | | 획득 방법 |
| `cor_image_url` | TEXT | | 침식 이미지 URL |
| `game_id` | TEXT | | 게임 내부 ID |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `passive_name_en` | TEXT | | 패시브 영문명 (i18n) |
| `passive_name_jp` | TEXT | | 패시브 일본어명 (i18n) |
| `passive_content_en` | TEXT | | 패시브 영문 내용 (i18n) |
| `passive_content_jp` | TEXT | | 패시브 일본어 내용 (i18n) |
| `obtaining_method_en` | TEXT | | 영문 획득 방법 (i18n) |
| `obtaining_method_jp` | TEXT | | 일본어 획득 방법 (i18n) |

- RLS: 모든 사용자 읽기 가능

---

### ego_skills (E.G.O 스킬)

E.G.O 각성/침식 스킬. 해석 3/4 단계별 저장.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `ego_id` | UUID | NOT NULL, FK → ego(id) ON DELETE CASCADE | 소속 EGO |
| `name` | TEXT | NOT NULL | 스킬명 |
| `skill_type` | TEXT | | 공격 타입 |
| `sin_affinity` | TEXT | | 죄악 속성 |
| `base_power` | INT | | 기본 위력 |
| `coin_power` | INT | | 코인 위력 |
| `coins` | INT | | 코인 수 |
| `atk_weight` | INT | DEFAULT 1 | 공격 가중치 |
| `skill_order` | INT | | 스킬 순서 |
| `offense_level` | INT | | 공격 레벨 |
| `description` | TEXT | DEFAULT '' | 스킬 설명 |
| `category` | TEXT | DEFAULT 'awakening' | `awakening` (각성) 또는 `corrosion` (침식) |
| `construe_level` | INT | DEFAULT 4 | 해석 단계 (3 또는 4) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `description_en` | TEXT | | 영문 설명 (i18n) |
| `description_jp` | TEXT | | 일본어 설명 (i18n) |

- 인덱스: `ego_id`

---

### keyword_meta (키워드 사전)

게임 키워드 메타데이터 (아이콘, 설명, 죄악 속성).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `name` | TEXT | PK | 키워드 한글명 |
| `description` | TEXT | | 키워드 설명 |
| `max_stack` | INT | | 최대 중첩 횟수 |
| `icon_slug` | TEXT | | 아이콘 슬러그 (`icons/keywords/{icon_slug}.webp`) |
| `sin_affinity` | TEXT | | 관련 죄악 (소문자 영문) |
| `category` | TEXT | DEFAULT '기타' | 키워드 카테고리 |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `description_en` | TEXT | | 영문 설명 (i18n) |
| `description_jp` | TEXT | | 일본어 설명 (i18n) |

- RLS: 모든 사용자 읽기 가능

---

### panic_types (패닉 유형)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 게임 panicType ID (9999, 9994 등) |
| `name` | TEXT | NOT NULL | 패닉 유형 이름 |
| `description` | TEXT | NOT NULL | 패닉 효과 설명 |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `description_en` | TEXT | | 영문 설명 (i18n) |
| `description_jp` | TEXT | | 일본어 설명 (i18n) |

- RLS: **비활성화** (읽기 전용 게임 데이터, 리스크 낮음)

---

### mental_condition_templates (정신력 조건 템플릿)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | TEXT | PK | 조건 템플릿 ID (e.g. `OnKillEnemyAsLevelRatioMultiply`) |
| `add_text` | TEXT | NOT NULL | KR 증가 텍스트 (`{0}`, `{1}` 플레이스홀더) |
| `min_text` | TEXT | NOT NULL | KR 감소 텍스트 |
| `add_text_en` | TEXT | | 영문 증가 텍스트 (i18n) |
| `add_text_jp` | TEXT | | 일본어 증가 텍스트 (i18n) |
| `min_text_en` | TEXT | | 영문 감소 텍스트 (i18n) |
| `min_text_jp` | TEXT | | 일본어 감소 텍스트 (i18n) |

- RLS: **비활성화** (읽기 전용 게임 데이터, 리스크 낮음)

---

### identity_sanity_conditions (인격 정신력 조건)

인격별 정신력 증감 조건. 템플릿의 플레이스홀더를 실제 수치로 대체하여 표시.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `template_id` | TEXT | NOT NULL, FK → mental_condition_templates(id) | |
| `condition_type` | TEXT | NOT NULL | `increase` 또는 `decrease` |
| `params` | INT[] | NOT NULL, DEFAULT `{}` | 플레이스홀더 대체 값 |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | 표시 순서 |

- RLS: **비활성화** (읽기 전용 게임 데이터)
- 인덱스: `identity_id`

---

### ego_gifts (EGO 기프트)

거울 던전 EGO 기프트. 구 `tier` 컬럼은 **존재하지 않음** (DROP됨).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `name` | TEXT | NOT NULL | 기프트 한글명 |
| `keyword` | TEXT | NOT NULL | 소속 키워드 |
| `grade` | TEXT | NOT NULL | 등급 (`1`~`5`, `EX`) |
| `enhancement` | BOOLEAN | DEFAULT false | 강화 기프트 여부 |
| `price` | INT | | 구매 가격 |
| `sell_price` | INT | | 판매 가격 |
| `buy_disabled` | BOOLEAN | DEFAULT false | 구매 불가 여부 |
| `effect_base` | TEXT | | 기본 효과 (KR) |
| `effect_plus` | TEXT | | + 효과 (KR) |
| `effect_plusplus` | TEXT | | ++ 효과 (KR) |
| `is_synthesis` | BOOLEAN | DEFAULT false | 합성 기프트 여부 |
| `first_appearance` | TEXT | | 최초 등장 |
| `related` | TEXT | | 관련 정보 |
| `image_url` | TEXT | | 이미지 URL |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `activation_condition` | JSONB | | 발동 조건 |
| `acquisition` | TEXT | | 획득 방법 |
| `game_id` | INT | | 게임 내부 ID (integer) |
| `difficulty` | TEXT | DEFAULT '노말' | 난이도 |
| `convert_to` | INT | | 변환 대상 game_id |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `effect_base_en` | TEXT | | 영문 기본 효과 (i18n) |
| `effect_base_jp` | TEXT | | 일본어 기본 효과 (i18n) |
| `effect_plus_en` | TEXT | | 영문 + 효과 (i18n) |
| `effect_plus_jp` | TEXT | | 일본어 + 효과 (i18n) |
| `effect_plusplus_en` | TEXT | | 영문 ++ 효과 (i18n) |
| `effect_plusplus_jp` | TEXT | | 일본어 ++ 효과 (i18n) |

> **정정**: 기존 문서에 `tier` 컬럼이 기재되어 있었으나 실제 DB에는 **존재하지 않는다** (ordinal position 5, 13 결락 확인).
> i18n 컬럼 `name_en/jp`, `effect_base_en/jp`, `effect_plus_en/jp`, `effect_plusplus_en/jp`는 **실제로 존재한다** (기존 문서에서 누락).

**activation_condition JSONB 구조:**
```jsonc
{
  "type": "keyword" | "multi_keyword" | "affiliation" | "skill",
  "keyword": "화상",            // type=keyword일 때
  "keywords": ["화상", "출혈"], // type=multi_keyword일 때
  "affiliation": "LCB",         // type=affiliation일 때
  "affiliations": ["LCB"],      // 복수 소속
  "skill_condition": "...",      // type=skill일 때
  "count": 3                     // 필요 인격 수
}
```

- RLS: 모든 사용자 읽기 가능
- 인덱스: `keyword`, `grade`
- sync: `scripts/sync-ego-gifts.mjs`

---

### ego_gift_themes (테마팩)

거울 던전 테마팩 정보.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 테마팩 ID (게임 데이터 기반, 1001~1510) |
| `name` | TEXT | NOT NULL | 테마팩 한글명 |
| `dungeon_id` | INT | | 던전 참조 |
| `unlock_code` | INT | | 해금 코드 |
| `ego_gift_ids` | INT[] | NOT NULL, DEFAULT `{}` | 소속 기프트 game_id 배열 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `specific_ego_gift_ids` | INT[] | NOT NULL, DEFAULT `{}` | 전용 기프트 game_id 배열 |
| `image_url` | TEXT | | 테마팩 선택 이미지 |
| `difficulty` | TEXT | DEFAULT 'normal' | `normal`, `hard`, `extreme` |
| `floor_info` | JSONB | | 층 등장 정보 |
| `boss_image_url` | TEXT | | 보스 이미지 |
| `is_hidden` | BOOLEAN | DEFAULT false | 히든 테마 여부 |
| `hidden_rate` | NUMERIC | | 히든 등장 확률 |
| `fixed_reward_gift_ids` | INT[] | | 고정 보상 기프트 game_id |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |

**floor_info JSONB 구조:**
```jsonc
{
  "노말": [1, 2],      // dungeonIdx=0
  "하드": [1, 2],      // dungeonIdx=1
  "평행중첩": [10],    // dungeonIdx=2 (하드 10층)
  "익스트림": [1, 2]   // dungeonIdx=3
}
```

- RLS: 모든 사용자 읽기 가능
- sync: `scripts/sync-ego-gift-themes.mjs`

---

### ego_gift_recipes (기프트 조합 레시피)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `result_name` | TEXT | NOT NULL | 결과 기프트명 |
| `keyword` | TEXT | NOT NULL | 소속 키워드 |
| `ingredients` | TEXT[] | NOT NULL | 재료 기프트명 배열 |
| `final_result` | TEXT | | 최종 결과물명 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기 가능

---

### md_events (거울 던전 이벤트 — 신 설계)

거울 던전 선택 이벤트 본체. `md_event_choices`와 1:N으로 연결.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 게임 이벤트 ID |
| `name` | TEXT | | 이벤트명 (KR) |
| `desc_text` | TEXT | | 이벤트 설명 (KR) |
| `source` | TEXT | | KR 텍스트 출처 파일명 |
| `image_url` | TEXT | | 이벤트 이미지 URL |
| `theme_ids` | INT[] | | 관련 테마팩 ID 배열 |
| `gift_ids` | INT[] | | 관련 기프트 game_id 배열 |
| `variant_of` | INT | FK → md_events(id) self-ref | 원본 이벤트 (변형 이벤트) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `event_type` | TEXT | | 이벤트 분류 |
| `category` | TEXT | DEFAULT 'NORMAL' | 카테고리 |
| `name_en` | TEXT | | 영문 번역명 (i18n) |
| `name_jp` | TEXT | | 일본어 번역명 (i18n) |
| `desc_text_en` | TEXT | | 영문 설명 (i18n) |
| `desc_text_jp` | TEXT | | 일본어 설명 (i18n) |

- RLS: 모든 사용자 읽기 가능

---

### md_event_choices (이벤트 선택지 — 신 설계)

`md_events`의 각 이벤트에 속하는 선택지.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `event_id` | INT | NOT NULL, FK → md_events(id) | 소속 이벤트 |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | 선택지 표시 순서 |
| `message` | TEXT | | 선택지 텍스트 |
| `message_desc` | TEXT | | 선택지 부가 설명 |
| `result_text` | TEXT | | 결과 텍스트 |
| `probability` | TEXT | | 확률 표시 |
| `next_event_id` | INT | FK → md_events(id) | 연쇄 이벤트 ID |
| `effects` | JSONB | | 선택 결과 효과 배열 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기 가능

---

### mirror_dungeon_events (거울 던전 이벤트 — 구 설계, ⚠️ Deprecate 예정)

`md_events` + `md_event_choices`로 이관 예정. 신규 개발 시 사용 금지.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 게임 이벤트 ID |
| `name` | TEXT | | 이벤트명 |
| `desc_text` | TEXT | | 이벤트 설명 |
| `options` | JSONB | | 선택지 배열 (JSONB 중첩) |
| `gift_ids` | INT[] | | 관련 기프트 game_id 배열 |
| `source` | TEXT | | 출처 파일명 |
| `image_url` | TEXT | | 이벤트 이미지 URL |
| `theme_ids` | INT[] | | 관련 테마팩 ID 배열 |
| `option_gifts` | JSONB | | 선택지별 기프트 ID |
| `parent_id` | INT | FK → mirror_dungeon_events(id) self-ref | 부모 이벤트 (연쇄) |

- RLS: **비활성화** (⚠️ + Deprecate 예정)

---

### md_plans (거울 던전 플래너)

유저가 공유하는 거울 던전 공략 플랜.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `user_id` | UUID | FK → profiles(id) | 작성자 |
| `title` | TEXT | NOT NULL | 플랜 제목 |
| `description` | TEXT | | 플랜 설명 |
| `difficulty` | TEXT | NOT NULL, DEFAULT 'normal' | 난이도 |
| `deck` | JSONB | NOT NULL, DEFAULT `[]` | 덱 편성 정보 |
| `egos` | JSONB | NOT NULL, DEFAULT `[]` | EGO 편성 정보 |
| `floor_plan` | JSONB | NOT NULL, DEFAULT `[]` | 층별 플랜 |
| `gift_inventory` | JSONB | NOT NULL, DEFAULT `[]` | 기프트 인벤토리 |
| `tags` | TEXT[] | DEFAULT `{}` | 태그 배열 |
| `vote_count` | INT | NOT NULL, DEFAULT 0 | 좋아요 수 |
| `view_count` | INT | NOT NULL, DEFAULT 0 | 조회 수 |
| `comment_count` | INT | NOT NULL, DEFAULT 0 | 댓글 수 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `lang` | VARCHAR | NOT NULL, DEFAULT 'ko' | 작성 언어 |

- RLS: 모든 사용자 읽기 가능

---

### md_plan_comments (플래너 댓글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `plan_id` | UUID | FK → md_plans(id) | 소속 플랜 |
| `user_id` | UUID | FK → profiles(id) | 작성자 |
| `content` | TEXT | NOT NULL | 댓글 내용 |
| `parent_id` | UUID | FK → md_plan_comments(id) self-ref | 대댓글 부모 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- RLS: 모든 사용자 읽기 가능

---

### md_plan_votes (플래너 좋아요)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `plan_id` | UUID | PK(복합), FK → md_plans(id) | |
| `user_id` | UUID | PK(복합), FK → profiles(id) | |

- RLS: 모든 사용자 읽기 가능

---

### profiles (유저 프로필)

`auth.users` 확장. 신규 가입 시 트리거로 자동 생성.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, FK → auth.users(id) ON DELETE CASCADE | |
| `username` | TEXT | UNIQUE | 사용자명 |
| `avatar_url` | TEXT | | 프로필 이미지 URL |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `bio` | TEXT | | 자기소개 |
| `collection_code` | TEXT | | 컬렉션 코드 |
| `role` | TEXT | DEFAULT 'user' | 역할 (`user`, `admin`) |
| `suspended` | BOOLEAN | DEFAULT false | 정지 여부 |
| `preferred_lang` | VARCHAR | NOT NULL, DEFAULT 'ko' | 선호 언어 |

- RLS: 모든 사용자 읽기, 본인만 수정
- RPC: `get_user_role(user_email)`, `is_user_suspended(user_email)`

---

### decks (덱)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `user_id` | UUID | FK → profiles(id) ON DELETE SET NULL | 작성자 |
| `title` | TEXT | NOT NULL | 덱 제목 |
| `description` | TEXT | | 덱 설명 |
| `tags` | TEXT[] | DEFAULT `{}` | 태그 배열 |
| `vote_count` | INT | DEFAULT 0 | 좋아요 수 |
| `view_count` | INT | DEFAULT 0 | 조회 수 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 자동 갱신 트리거 |
| `deck_code` | TEXT | | 편성 코드 |
| `comment_count` | INT | DEFAULT 0 | 댓글 수 |
| `content_type` | VARCHAR | DEFAULT '없음' | 콘텐츠 유형 |
| `lang` | VARCHAR | NOT NULL, DEFAULT 'ko' | 작성 언어 |

- RLS: 모든 사용자 읽기, 로그인 유저 생성, 본인만 수정/삭제
- RPC: `increment_vote`, `decrement_vote`, `increment_view`, `increment_comment`, `decrement_comment`

---

### deck_identities (덱 인격 편성)

최대 12명 (수감자당 1인격).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `deck_id` | UUID | PK(복합), FK → decks(id) ON DELETE CASCADE | |
| `identity_id` | UUID | PK(복합), FK → identities(id) ON DELETE CASCADE | |
| `slot_order` | INT | | 편성 순서 |
| `gacksung` | BOOLEAN | DEFAULT false | 각성 여부 |
| `s1_count` | INT | DEFAULT 3 | 스킬 1 배분 |
| `s2_count` | INT | DEFAULT 2 | 스킬 2 배분 |
| `s3_count` | INT | DEFAULT 1 | 스킬 3 배분 |

- RLS: **비활성화** (⚠️ 보안 갭)

---

### deck_egos (덱 EGO 편성)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `deck_id` | UUID | NOT NULL, FK → decks(id) ON DELETE CASCADE | |
| `ego_id` | UUID | NOT NULL, FK → ego(id) | |
| `grade` | TEXT | NOT NULL | EGO 등급 (`ZAYIN`~`ALEPH`) |

- UNIQUE: (`deck_id`, `ego_id`)

---

### deck_votes (좋아요)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `deck_id` | UUID | PK(복합), FK → decks(id) ON DELETE CASCADE | |
| `user_id` | UUID | PK(복합), FK → profiles(id) ON DELETE CASCADE | |

---

### deck_bookmarks (북마크)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `deck_id` | UUID | PK(복합), FK → decks(id) ON DELETE CASCADE | |
| `user_id` | UUID | PK(복합), FK → profiles(id) ON DELETE CASCADE | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### deck_comments (덱 댓글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `deck_id` | UUID | FK → decks(id) ON DELETE CASCADE | |
| `user_id` | UUID | FK → profiles(id) ON DELETE SET NULL | |
| `content` | TEXT | NOT NULL | 댓글 내용 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `parent_id` | UUID | FK → deck_comments(id) | 대댓글 부모 |

---

### identity_reviews (인격 리뷰)

인격당 1인 1리뷰 (개추/비추 + 한줄평).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `user_id` | UUID | NOT NULL, FK → profiles(id) ON DELETE CASCADE | |
| `is_positive` | BOOLEAN | NOT NULL | true=개추, false=비추 |
| `content` | TEXT | DEFAULT '' | 한줄평 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- UNIQUE: (`identity_id`, `user_id`)
- RLS: 모든 사용자 읽기, 로그인 유저 추가, 본인만 수정/삭제

---

### identity_guides (인격 운영법 가이드)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `author_id` | UUID | NOT NULL, FK → profiles(id) | |
| `content` | TEXT | NOT NULL, DEFAULT '' | 가이드 본문 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 자동 갱신 트리거 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `title` | TEXT | NOT NULL, DEFAULT '' | 가이드 제목 |
| `lang` | VARCHAR | NOT NULL, DEFAULT 'ko' | 작성 언어 |

---

### identity_sentiment (커뮤니티 감성 분석)

외부 커뮤니티(디시인사이드 등)의 인격 언급 감성 분석 결과.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_name` | TEXT | NOT NULL | 인격명 |
| `sinner_name` | TEXT | | 수감자명 |
| `source` | TEXT | NOT NULL | 출처 (`dcinside` 등) |
| `gallery` | TEXT | | 갤러리 ID |
| `mention_count` | INT | DEFAULT 0 | 언급 수 |
| `positive_count` | INT | DEFAULT 0 | 긍정 수 |
| `negative_count` | INT | DEFAULT 0 | 부정 수 |
| `neutral_count` | INT | DEFAULT 0 | 중립 수 |
| `sentiment_score` | NUMERIC | | 감성 점수 |
| `sample_texts` | JSONB | DEFAULT `[]` | 샘플 텍스트 배열 |
| `keywords` | JSONB | DEFAULT `[]` | 키워드 배열 |
| `collected_at` | TIMESTAMPTZ | DEFAULT now() | 수집 일시 |
| `period_start` | DATE | NOT NULL | 분석 기간 시작 |
| `period_end` | DATE | NOT NULL | 분석 기간 종료 |
| `identity_id` | UUID | FK → identities(id) | 인격 참조 |

- RLS: **비활성화**

---

### identity_sentiment_trend (감성 트렌드 — 뷰)

`identity_sentiment` 데이터를 집계한 읽기 전용 뷰.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `identity_name` | TEXT | 인격명 |
| `sinner_name` | TEXT | 수감자명 |
| `period_start` | DATE | 기간 시작 |
| `total_mentions` | BIGINT | 총 언급 수 |
| `total_positive` | BIGINT | 총 긍정 수 |
| `total_negative` | BIGINT | 총 부정 수 |
| `avg_sentiment` | NUMERIC | 평균 감성 점수 |

---

### identity_ai_summaries (인격 AI 요약)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `identity_id` | UUID | PK, FK → identities(id) | |
| `summary` | TEXT | NOT NULL | AI 요약 내용 |
| `model` | TEXT | NOT NULL, DEFAULT 'gpt-5.4' | 사용 모델 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `lang` | VARCHAR | NOT NULL, DEFAULT 'ko' | 언어 |

---

### tier_list (티어 리스트)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) | |
| `category` | VARCHAR | NOT NULL, DEFAULT 'reroll' | 티어표 맥락 (`reroll`, `overall`, `mirror_dungeon`, `goodstuff`) |
| `tier` | VARCHAR | NOT NULL | 티어 (`S+`, `S`, `A`, `B`, `C`, `N/A`); migration에서 기존 짧은 VARCHAR 폭을 확장 |
| `sort_order` | INT | DEFAULT 0 | 티어 내 순서 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

- UNIQUE: (`category`, `identity_id`)
- Index: (`category`, `sort_order`)
- 기존 category 없는 행은 `reroll`로 취급한다.
- 카테고리 라벨: `reroll`=`리세`, `overall`=`종합`, `mirror_dungeon`=`거던`, `goodstuff`=`굿스터프`

---

### tier_ratings (티어표 평가/댓글)

카테고리별 인격 평가. `N/A`는 평가가 0개인 상태이며, 1개 이상은 평균 점수로 티어를 산정한다. 낮은 점수 자체는 `C`로 집계하고, 표본이 적은 평가는 UI에서 낮은 신뢰도 경고로 표시한다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `user_id` | UUID | NOT NULL, FK → profiles(id) ON DELETE CASCADE | 작성자 |
| `category` | VARCHAR | NOT NULL | 저장 가능한 평가 맥락 (`reroll`, `mirror_dungeon`, `goodstuff`) |
| `score` | INT | NOT NULL, CHECK 1-10 | 평가 점수 |
| `comment` | TEXT | NOT NULL, DEFAULT '', 최대 280자 | 평가 코멘트 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 자동 갱신 트리거 |

- UNIQUE: (`identity_id`, `user_id`, `category`)
- RLS: 모든 사용자 읽기, 인증된 본인만 생성/수정/삭제
- Index: (`identity_id`, `category`), (`user_id`, `category`), (`identity_id`, `category`, `created_at DESC`)
- 집계 티어 기준: 5개 미만 `N/A`, 평균 9.2 이상 `S+`, 8.4 이상 `S`, 7.2 이상 `A`, 6.0 이상 `B`, 그 미만 `C`
- 저장되는 사용자 평가 category 값은 `reroll`, `mirror_dungeon`, `goodstuff` 중 하나이다.
- `overall`/`종합`은 `reroll`, `goodstuff`, `mirror_dungeon` 평가에서 파생되는 읽기 전용 집계이며 `tier_ratings`에 직접 저장하지 않는다.

---

### tier_rating_reports (티어표 평가 댓글 신고)

티어표 평가 댓글 신고. 공개 조회는 제공하지 않으며, API는 신고자 정보를 공개하지 않는다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `rating_id` | UUID | NOT NULL, FK → tier_ratings(id) ON DELETE CASCADE | 신고 대상 평가 |
| `reporter_id` | UUID | NOT NULL, FK → profiles(id) ON DELETE CASCADE | 신고자 |
| `reason` | TEXT | NOT NULL, DEFAULT 'inappropriate' | 신고 사유 |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | 처리 상태 (`pending`, `reviewed`, `dismissed`, `resolved`) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

- UNIQUE: (`rating_id`, `reporter_id`)
- RLS: 공개 조회 없음, 인증된 본인 신고 생성/대기 상태 수정만 허용
- Index: (`rating_id`), (`reporter_id`), (`status`, `created_at DESC`)

---

### story_characters (스토리 등장인물)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `name` | TEXT | NOT NULL | 한글 이름 |
| `en_name` | TEXT | | 영문 이름 |
| `jp_name` | TEXT | | 일본어 이름 |
| `file_name` | TEXT | NOT NULL | 스프라이트 파일명 |
| `nick_name` | TEXT | | 별칭 |
| `name_tag_color` | TEXT | | 이름표 색상 |
| `portrait_sprite_path` | TEXT | | 초상화 스프라이트 경로 |
| `staring_side` | TEXT | DEFAULT 'middle' | 시선 방향 |

---

### story_episodes (스토리 에피소드)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | TEXT | PK | 에피소드 ID |
| `chapter` | TEXT | NOT NULL | 챕터 |
| `chapter_title` | TEXT | | 챕터 제목 |
| `episode_title` | TEXT | | 에피소드 제목 |
| `sort_order` | INT | NOT NULL | 표시 순서 |
| `episode_type` | TEXT | DEFAULT 'dialog' | 에피소드 유형 |
| `line_count` | INT | DEFAULT 0 | 대사 수 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### story_lines (스토리 대사)

에피소드의 대사/연출 데이터.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `episode_id` | TEXT | NOT NULL, FK → story_episodes(id) | 소속 에피소드 |
| `line_index` | INT | NOT NULL | 대사 순서 |
| `teller` | TEXT | | 화자 |
| `model` | TEXT | | 모델 지시자 |
| `content` | TEXT | | 대사 내용 |
| `place` | TEXT | | 장소 |
| `bg` | TEXT | | 배경 이미지 |
| `bgm` | TEXT | | BGM |
| `cg` | TEXT | | CG 이미지 |
| `effect` | TEXT | | 연출 효과 |
| `feeling` | TEXT | | 감정 표현 |
| `character_list` | TEXT | | 등장 캐릭터 목록 |
| `sound_effect` | TEXT | | 효과음 |

---

### announcements (공지사항)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `title` | TEXT | NOT NULL | 공지 제목 |
| `content` | TEXT | NOT NULL, DEFAULT '' | 공지 내용 |
| `pinned` | BOOLEAN | DEFAULT false | 상단 고정 여부 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### site_maintenance (점검 상태)

페이지별 점검 상태 관리. `proxy.ts`에서 점검 중인 경로 접근 시 `/maintenance`로 리다이렉트.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `path` | TEXT | NOT NULL | 점검 대상 경로 (e.g. `/sinners`) |
| `label` | TEXT | DEFAULT '' | 관리 화면 표시명 |
| `message` | TEXT | NOT NULL, DEFAULT '현재 점검 중입니다. 잠시 후 다시 시도해주세요.' | 점검 안내 메시지 |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT false | 점검 활성화 여부 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `reason` | TEXT | NOT NULL, DEFAULT '' | 점검 사유 |
| `ends_at` | TIMESTAMPTZ | | 점검 종료 예정 시각 |

---

### audit_logs (감사 로그)

관리자/운영진 활동 기록.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `actor_id` | UUID | FK → profiles(id) | 행위자 |
| `action` | TEXT | NOT NULL | 행위 유형 (`role_change`, `guide_create`, `suspend` 등) |
| `target_type` | TEXT | | 대상 유형 (`user`, `guide`, `deck`) |
| `target_id` | TEXT | | 대상 ID |
| `details` | JSONB | DEFAULT `{}` | 추가 정보 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### game_translations (게임 데이터 번역)

EN/JP 번역 오버레이 테이블. 일부 테이블에 i18n 인라인 컬럼이 있어도, 추가 오버레이가 필요한 경우 여기에 저장.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `entity_type` | TEXT | NOT NULL | `identity`, `ego`, `skill`, `passive`, `keyword`, `ego_gift`, `buf` |
| `entity_id` | TEXT | NOT NULL | game_id, 키워드명, 또는 안정적인 문자열 키 |
| `lang` | VARCHAR | NOT NULL | `en` 또는 `ja` |
| `name` | TEXT | NOT NULL | 번역된 이름 |
| `description` | TEXT | | 번역된 설명 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- UNIQUE: (`entity_type`, `entity_id`, `lang`)

---

### ai_summaries (AI 요약 캐시)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `target_type` | TEXT | NOT NULL | 대상 유형 |
| `target_id` | TEXT | NOT NULL | 대상 ID |
| `lang` | VARCHAR | NOT NULL | 언어 |
| `content` | TEXT | NOT NULL | 요약 내용 |
| `model` | TEXT | | 사용 모델 |
| `created_by` | UUID | FK → profiles(id) | 생성자 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### app_config (앱 설정)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `key` | TEXT | PK | 설정 키 |
| `value` | JSONB | NOT NULL | 설정 값 (JSONB) |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### legal_docs (법적 문서)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `type` | TEXT | PK(복합) | 문서 유형 (`terms`, `privacy` 등) |
| `title` | TEXT | NOT NULL | 문서 제목 |
| `last_updated` | TEXT | NOT NULL | 마지막 업데이트 일자 |
| `sections` | JSONB | NOT NULL, DEFAULT `[]` | 섹션 배열 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |
| `lang` | TEXT | NOT NULL, DEFAULT 'ko' | 언어 |

- RLS: **비활성화** (공개 문서, 의도적)

---

### chat_logs (채팅 기록)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `user_id` | UUID | NOT NULL, FK → profiles(id) | 사용자 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

> `content` 등 실제 채팅 내용 컬럼이 없음 — 간이 로그 또는 마이그레이션 과정에서 일부 컬럼 DROP된 것으로 추정. 사용 여부 확인 필요.

---

### guild_settings (Discord 서버 설정)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `guild_id` | TEXT | PK | Discord 서버 ID |
| `notification_channel_id` | TEXT | | 알림 채널 ID |
| `steam_enabled` | BOOLEAN | DEFAULT true | Steam 피드 활성화 |
| `twitter_enabled` | BOOLEAN | DEFAULT true | Twitter 피드 활성화 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### guild_feed_history (피드 발송 이력)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | BIGINT | PK | |
| `guild_id` | TEXT | NOT NULL | Discord 서버 ID |
| `source` | TEXT | NOT NULL | 피드 출처 (`steam`, `twitter`) |
| `feed_guid` | TEXT | NOT NULL | 피드 GUID (중복 방지) |
| `pub_date` | TIMESTAMPTZ | | 원본 게시 일시 |
| `sent_at` | TIMESTAMPTZ | DEFAULT now() | 발송 일시 |

- RLS: **비활성화** (Discord 봇 전용)

---

### feed_tracker (피드 추적)

외부 피드의 마지막 체크 상태.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `source` | TEXT | PK | 피드 출처 (`steam`, `twitter`) |
| `last_id` | TEXT | | 마지막 처리 ID |
| `last_checked_at` | TIMESTAMPTZ | DEFAULT now() | 마지막 체크 시각 |
| `last_pub_date` | TIMESTAMPTZ | | 마지막 게시 일시 |

---

### tickets (Discord 티켓)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `guild_id` | TEXT | NOT NULL | Discord 서버 ID |
| `user_id` | TEXT | NOT NULL | Discord 유저 ID |
| `channel_id` | TEXT | | 티켓 채널 ID |
| `status` | TEXT | NOT NULL, DEFAULT 'open' | 상태 (`open`, `closed`) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `closed_at` | TIMESTAMPTZ | | 종료 일시 |
| `closed_by` | TEXT | | 종료한 유저 ID |
| `transcript_url` | TEXT | | 대화 기록 URL |

---

### warnings (Discord 경고)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `guild_id` | TEXT | NOT NULL | Discord 서버 ID |
| `user_id` | TEXT | NOT NULL | 경고 대상 유저 ID |
| `moderator_id` | TEXT | NOT NULL | 경고 발행 운영자 ID |
| `reason` | TEXT | NOT NULL | 경고 사유 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

---

## i18n 전략

두 가지 방식이 혼용된다:

### 1. 인라인 i18n 컬럼 (테이블별 `_en`/`_jp` 컬럼)

| 테이블 | i18n 컬럼 |
|--------|-----------|
| `sinners` | `name_en`, `name_jp` |
| `identities` | `name_en`, `name_jp` |
| `skills` | `name_en`, `name_jp`, `description_en`, `description_jp` |
| `passives` | `name_en`, `name_jp`, `description_en`, `description_jp` |
| `ego` | `name_en`, `name_jp`, `passive_name_en/jp`, `passive_content_en/jp`, `obtaining_method_en/jp` |
| `ego_skills` | `name_en`, `name_jp`, `description_en`, `description_jp` |
| `ego_gifts` | `name_en`, `name_jp`, `effect_base_en/jp`, `effect_plus_en/jp`, `effect_plusplus_en/jp` |
| `ego_gift_themes` | `name_en`, `name_jp` |
| `md_events` | `name_en`, `name_jp`, `desc_text_en`, `desc_text_jp` |
| `keyword_meta` | `name_en`, `name_jp`, `description_en`, `description_jp` |
| `panic_types` | `name_en`, `name_jp`, `description_en`, `description_jp` |
| `mental_condition_templates` | `add_text_en/jp`, `min_text_en/jp` |

### 2. 오버레이 i18n (`game_translations` 테이블)

`entity_type` / `entity_id` / `lang` 조합으로 추가 번역 저장. 인라인 컬럼이 없거나 보완이 필요한 엔티티에 사용.

---

## ER 관계도 (텍스트)

```
sinners (1)──(N) identities (1)──(N) skills
                             (1)──(N) passives
                             (1)──(N) identity_sanity_conditions → mental_condition_templates
                             (1)──(N) identity_reviews
                             (1)──(N) identity_guides
                             (1)──(N) identity_ai_summaries
                             (1)──(N) identity_sentiment
                             (1)──(N) tier_list
                             (N)──(1) panic_types

sinners (1)──(N) ego (1)──(N) ego_skills

profiles (1)──(N) decks (1)──(N) deck_identities ──(N:1) identities
                       (1)──(N) deck_egos ──(N:1) ego
                       (1)──(N) deck_votes ──(N:1) profiles
                       (1)──(N) deck_bookmarks ──(N:1) profiles
                       (1)──(N) deck_comments

profiles (1)──(N) md_plans (1)──(N) md_plan_comments
                           (1)──(N) md_plan_votes

md_events (1)──(N) md_event_choices
md_events self-ref: variant_of
mirror_dungeon_events self-ref: parent_id  [구 설계]

story_episodes (1)──(N) story_lines
```

---

## RPC 함수

| 함수 | 설명 |
|------|------|
| `increment_vote(deck_id)` | 덱 좋아요 수 +1 |
| `decrement_vote(deck_id)` | 덱 좋아요 수 -1 (최소 0) |
| `increment_view(deck_id)` | 덱 조회수 +1 |
| `increment_comment(deck_id)` | 덱 댓글 수 +1 |
| `decrement_comment(deck_id)` | 덱 댓글 수 -1 (최소 0) |
| `get_user_role(user_email)` | 이메일로 유저 역할 조회 |
| `is_user_suspended(user_email)` | 이메일로 유저 정지 상태 조회 |
| `handle_new_user()` | 신규 가입 트리거 → 프로필 자동 생성 |
| `update_updated_at()` | updated_at 자동 갱신 트리거 함수 |
| `upsert_ai_summary(...)` | AI 요약 upsert |

---

## 트리거

| 트리거 | 테이블 | 시점 | 함수 |
|--------|--------|------|------|
| `decks_updated_at` | `decks` | BEFORE UPDATE | `update_updated_at()` |
| `announcements_updated_at` | `announcements` | BEFORE UPDATE | `update_updated_at()` |
| `identity_guides_updated_at` | `identity_guides` | BEFORE UPDATE | `update_updated_at()` |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |

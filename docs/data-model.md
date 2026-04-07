# 데이터 모델 (DB Schema)

SAIGO NO DANTE 프로젝트의 데이터베이스 스키마 문서.
Supabase (PostgreSQL) 위에 `limbus` 커스텀 스키마를 사용한다.

> Supabase Dashboard > Settings > API > Extra search path에 `limbus`가 추가되어야 한다.

---

## 테이블 목록

### 게임 데이터 (읽기 전용)
| 테이블 | 설명 |
|--------|------|
| `sinners` | 12명의 수감자 기본 정보 |
| `identities` | 인격 카드 |
| `skills` | 인격 스킬 (업타이 3/4) |
| `passives` | 인격 패시브 |
| `ego` | E.G.O |
| `ego_skills` | E.G.O 스킬 (각성/침식, 해석 3/4) |
| `keyword_meta` | 키워드 사전 (아이콘, 설명, 죄악 속성) |
| `panic_types` | 패닉 유형 |
| `mental_condition_templates` | 정신력 조건 템플릿 |
| `identity_sanity_conditions` | 인격별 정신력 조건 |

### 거울 던전
| 테이블 | 설명 |
|--------|------|
| `ego_gifts` | EGO 기프트 |
| `ego_gift_themes` | 테마팩 |
| `ego_gift_recipes` | 기프트 조합 레시피 |
| `mirror_dungeon_events` | 거울 던전 이벤트 |

### 사용자/커뮤니티
| 테이블 | 설명 |
|--------|------|
| `profiles` | 유저 프로필 (auth.users 확장) |
| `decks` | 덱 |
| `deck_identities` | 덱-인격 편성 |
| `deck_egos` | 덱-EGO 편성 |
| `deck_votes` | 덱 좋아요 |
| `deck_bookmarks` | 덱 북마크 |
| `deck_comments` | 덱 댓글 |
| `identity_reviews` | 인격 리뷰 (개추/비추) |
| `identity_guides` | 인격 운영법 가이드 |

### 시스템/관리
| 테이블 | 설명 |
|--------|------|
| `announcements` | 공지사항 |
| `site_maintenance` | 페이지별 점검 상태 |
| `audit_logs` | 관리자 활동 로그 |
| `game_translations` | 게임 데이터 번역 오버레이 (EN/JA) |
| `ai_summaries` | AI 요약 캐시 (다국어) |

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
| `order_num` | INT | UNIQUE | 표시 순서 (1-12) |

- RLS: 모든 사용자 읽기 가능

---

### identities (인격)

인격 카드 정보. 스킬/패시브/정신력 조건은 별도 테이블에서 FK로 연결.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `sinner_id` | TEXT | FK → sinners(id) | 소속 수감자 |
| `name` | TEXT | NOT NULL | 영문 이름 |
| `name_kr` | TEXT | | 한글 이름 |
| `tier` | INT | DEFAULT 1 | 해금 티어 (1-4) |
| `hp` | INT | | 체력 |
| `speed_min` | INT | | 최소 속도 |
| `speed_max` | INT | | 최대 속도 |
| `def_level` | INT | | 방어 레벨 |
| `sin_affinity` | TEXT | | 죄악 속성 (`wrath`, `lust`, `sloth` 등) |
| `keywords` | TEXT[] | | 키워드 배열 |
| `rarity` | INT | NOT NULL, DEFAULT 1 | 등급 (1, 2, 3) |
| `game_id` | TEXT | | 게임 내부 ID (이미지 파일 접두사) |
| `folder_name` | TEXT | | Supabase Storage 영문 폴더명 |
| `affiliation` | TEXT | | 소속 (한글: `LCB`, `세븐 협회`, `검계` 등) |
| `panic_type` | INT | FK → panic_types(id) | 패닉 유형 ID |
| `quote` | TEXT | | 인격 대사 |
| `slash_res` | TEXT | | 참격 내성 |
| `pierce_res` | TEXT | | 관통 내성 |
| `blunt_res` | TEXT | | 타격 내성 |
| `release_date` | TEXT | | 출시일 |
| `acquisition` | TEXT | | 획득 방법 텍스트 |
| `acquisition_info` | JSONB | | 획득 정보 구조화 데이터 |
| `break_section` | INT[] | | 브레이크 구간 |
| `base_hp` | INT | | 기본 HP |
| `hp_per_level` | INT | | 레벨당 HP |
| `bg_image_url` | TEXT | | 배경 이미지 URL |

**acquisition_info JSONB 구조:**
```jsonc
{
  "type": "default" | "standard" | "event" | "walpurgis" | "attendance",
  "release_season": 3,
  "fragment_cost": 400,          // 자아 파편 교환 비용 (null이면 교환 불가)
  "gacha": "always" | "seasonal" | "walpurgis" | "none",
  "gacha_from_season": 4,        // 상시 추출 가능 시즌 (optional)
  "target_sinner": "yi-sang",    // 타겟 수감자 (optional)
  "exchange_from_season": 4,     // 교환 가능 시즌 (optional)
  "walpurgis_edition": 1,        // 발푸르기스 에디션 (optional)
  "event_name": "...",           // 이벤트명 (optional)
  "event_currency": "...",       // 이벤트 재화 (optional)
  "event_cost": 100              // 이벤트 비용 (optional)
}
```

- RLS: 모든 사용자 읽기 가능
- 인덱스: `sinner_id`

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
| `atk_weight` | INT | | 공격 가중치 |
| `offense_level` | INT | | 공격 레벨 (60 + skillLevelCorrection). 프론트엔드에서 `offense_level - 60`으로 보정값 표시 |
| `quantity` | INT | | 수량 |
| `uptie_level` | INT | DEFAULT 3 | 동기화 단계 (3 또는 4) |
| `variant_order` | INT | | 삽입 순서 (프론트엔드 표시 순서 보장) |

- RLS: 모든 사용자 읽기 가능

---

### passives (패시브)

인격 패시브 스킬.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | FK → identities(id) ON DELETE CASCADE | 소속 인격 |
| `passive_type` | TEXT | NOT NULL | `battle` 또는 `support` |
| `name` | TEXT | NOT NULL | 패시브명 |
| `sin_affinity` | TEXT | | 발동 조건 죄악 타입 (nullable) |
| `sin_count` | INT | | 필요 자원 수 |
| `active_cond` | TEXT | | 발동 조건 유형 (`공명`, `보유` 등) |
| `description` | TEXT | | 패시브 설명 |
| `passive_order` | INT | DEFAULT 1 | 같은 타입 내 순서 |
| `uptie_level` | INT | DEFAULT 3 | 동기화 단계 (3 또는 4) |

- RLS: 모든 사용자 읽기 가능
- 인덱스: `identity_id`

---

### ego (E.G.O)

E.G.O 장비 정보.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `sinner_id` | TEXT | FK → sinners(id) | 소속 수감자 |
| `name` | TEXT | NOT NULL | 영문 이름 |
| `name_kr` | TEXT | | 한글 이름 |
| `grade` | TEXT | | `ZAYIN`, `TETH`, `HE`, `WAW`, `ALEPH` |
| `sin_affinity` | TEXT | | 죄악 속성 |
| `description` | TEXT | | 설명 |
| `corrosion_risk` | TEXT | | 침식 위험도 |
| `folder_name` | TEXT | | 로컬 폴더명 (이미지 경로) |
| `image_url` | TEXT | | awaken_profile.webp 전체 URL |
| `passive_name` | TEXT | | 패시브 이름 |
| `passive_content` | TEXT | | 패시브 내용 |
| `resistance` | TEXT[] | | 죄악 내성 배열 (7개) |
| `cost` | INT[] | | 죄악 코스트 배열 (7개) |
| `keywords` | TEXT[] | | 전용 키워드 |
| `obtaining_method` | TEXT | | 획득 방법 |
| `cor_image_url` | TEXT | | 침식 이미지 URL |
| `game_id` | TEXT | | 게임 내부 ID |

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
| `atk_weight` | INT | | 공격 가중치 |
| `skill_order` | INT | DEFAULT 1 | 스킬 순서 |
| `offense_level` | INT | | 공격 레벨 |
| `description` | TEXT | | 스킬 설명 |
| `category` | TEXT | | `awakening` (각성) 또는 `corrosion` (침식) |
| `construe_level` | INT | | 해석 단계 (3 또는 4) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- 인덱스: `ego_id`

---

### keyword_meta (키워드 사전)

게임 키워드 메타데이터 (아이콘, 설명, 죄악 속성).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `name` | TEXT | PK | 키워드 한글명 |
| `description` | TEXT | | 키워드 설명 |
| `max_stack` | INT | | 최대 중첩 횟수 (nullable) |
| `icon_slug` | TEXT | | 아이콘 슬러그 (`icons/keywords/{icon_slug}.webp`) |
| `sin_affinity` | TEXT | | 관련 죄악 (소문자 영문: `wrath`, `lust` 등, nullable) |

- RLS: 모든 사용자 읽기 가능

---

### panic_types (패닉 유형)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 게임 panicType ID (9999, 9994 등) |
| `name` | TEXT | NOT NULL | 패닉 유형 이름 (e.g. "패닉") |
| `description` | TEXT | NOT NULL | 패닉 효과 설명 |

---

### mental_condition_templates (정신력 조건 템플릿)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | TEXT | PK | 조건 템플릿 ID (e.g. `OnKillEnemyAsLevelRatioMultiply`) |
| `add_text` | TEXT | NOT NULL | KR 증가 텍스트 (`{0}`, `{1}` 플레이스홀더) |
| `min_text` | TEXT | NOT NULL | KR 감소 텍스트 |

---

### identity_sanity_conditions (인격 정신력 조건)

인격별 정신력 증감 조건. 템플릿의 플레이스홀더를 실제 수치로 대체하여 표시.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `template_id` | TEXT | NOT NULL, FK → mental_condition_templates(id) | |
| `condition_type` | TEXT | NOT NULL, CHECK (`increase`/`decrease`) | 증가 또는 감소 |
| `params` | INT[] | NOT NULL, DEFAULT `{}` | 플레이스홀더 대체 값 |
| `sort_order` | INT | NOT NULL, DEFAULT 0 | 표시 순서 |

- 인덱스: `identity_id`

---

### ego_gifts (EGO 기프트)

거울 던전 EGO 기프트.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `game_id` | INT | | 게임 내부 ID |
| `name` | TEXT | NOT NULL, UNIQUE | 기프트 한글명 |
| `keyword` | TEXT | NOT NULL | 소속 키워드 |
| `grade` | TEXT | NOT NULL | 등급 (`1`~`5`, `EX`) |
| `tier` | TEXT | | 티어 |
| `enhancement` | BOOLEAN | DEFAULT false | 강화 기프트 여부 |
| `price` | INT | | 구매 가격 |
| `sell_price` | INT | | 판매 가격 |
| `buy_disabled` | BOOLEAN | DEFAULT false | 구매 불가 여부 |
| `effect_base` | TEXT | | 기본 효과 |
| `effect_plus` | TEXT | | + 효과 |
| `effect_plusplus` | TEXT | | ++ 효과 |
| `is_synthesis` | BOOLEAN | DEFAULT false | 합성 기프트 여부 |
| `first_appearance` | TEXT | | 최초 등장 |
| `related` | TEXT | | 관련 정보 |
| `image_url` | TEXT | | 이미지 URL |
| `activation_condition` | JSONB | nullable | 발동 조건 |
| `acquisition` | TEXT | | 획득 방법 |
| `difficulty` | TEXT | | 난이도 (`normal`, `hard`, `extreme`) |
| `convert_to` | INT | | 변환 대상 game_id |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

**activation_condition JSONB 구조:**
```jsonc
{
  "type": "keyword" | "multi_keyword" | "affiliation" | "skill",
  "keyword": "화상",           // type=keyword일 때
  "keywords": ["화상", "출혈"], // type=multi_keyword일 때
  "affiliation": "LCB",        // type=affiliation일 때
  "affiliations": ["LCB"],     // 복수 소속
  "skill_condition": "...",     // type=skill일 때
  "count": 3                    // 필요 인격 수
}
```

> 강화 효과 기프트 (전격부, 거울 속의 꽃 등)는 `activation_condition`이 NULL이다.

- RLS: 모든 사용자 읽기 가능
- 인덱스: `keyword`, `grade`

---

### ego_gift_themes (테마팩)

거울 던전 테마팩 정보.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 테마팩 ID (게임 데이터 기반, 1001~1510) |
| `name` | TEXT | | 테마팩 한글명 |
| `dungeon_id` | INT | nullable | 던전 참조 |
| `unlock_code` | INT | nullable | 해금 코드 |
| `ego_gift_ids` | INT[] | | 소속 기프트 game_id 배열 |
| `specific_ego_gift_ids` | INT[] | | 전용 기프트 game_id 배열 |
| `image_url` | TEXT | | 테마팩 선택 이미지 (`icons/theme-packs/{packSpriteId}.webp`, 380x690) |
| `boss_image_url` | TEXT | | 보스 이미지 (`icons/theme-packs/boss/{bossSpriteId}.webp`, 391x432) |
| `difficulty` | TEXT | | `normal`, `hard`, `extreme` |
| `floor_info` | JSONB | nullable | 층 등장 정보 |
| `is_hidden` | BOOLEAN | | 히든 테마 여부 |
| `hidden_rate` | FLOAT | nullable | 히든 등장 확률 |
| `fixed_reward_gift_ids` | INT[] | nullable | 고정 보상 기프트 game_id |

**floor_info JSONB 구조:**
```jsonc
{
  "노말": [1, 2],       // dungeonIdx=0
  "하드": [1, 2],       // dungeonIdx=1
  "평행중첩": [10],     // dungeonIdx=2 (하드 10층)
  "익스트림": [1, 2]    // dungeonIdx=3
}
```

- RLS: 모든 사용자 읽기 가능

---

### ego_gift_recipes (기프트 조합 레시피)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `result_name` | TEXT | NOT NULL | 결과 기프트명 |
| `keyword` | TEXT | NOT NULL | 소속 키워드 |
| `ingredients` | TEXT[] | NOT NULL | 재료 기프트명 배열 |
| `final_result` | TEXT | nullable | 최종 결과물명 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기 가능
- 인덱스: `keyword`

---

### mirror_dungeon_events (거울 던전 이벤트)

거울 던전 내 선택 이벤트. 옵션/보상은 JSONB `options` 컬럼에 중첩 저장.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT | PK | 게임 이벤트 ID |
| `name` | TEXT | nullable | 이벤트명 |
| `desc_text` | TEXT | nullable | 이벤트 설명 |
| `options` | JSONB | nullable | 선택지 배열 |
| `gift_ids` | INT[] | nullable | 관련 기프트 game_id 배열 |
| `option_gifts` | INT[][] | nullable | 선택지별 기프트 ID 배열 |
| `source` | TEXT | | KR 텍스트 출처 파일명 |
| `parent_id` | INT | nullable, FK → mirror_dungeon_events(id) | 부모 이벤트 (연쇄 이벤트) |
| `theme_ids` | INT[] | nullable | 관련 테마팩 ID 배열 |
| `image_url` | TEXT | nullable | 이벤트 이미지 URL |

**options JSONB 구조:**
```jsonc
[
  {
    "message": "선택지 텍스트",
    "messageDesc": "선택지 부가 설명",
    "result": ["결과 텍스트 1", "결과 텍스트 2"],
    "rewards": [
      {
        "probability": 0.5,
        "effects": [
          { "type": "gift", "gift_id": 12345 },
          { "type": "cost", "amount": 100 },
          { "type": "hp_loss", "amount": 20 }
        ]
      }
    ],
    "next_event": {
      "id": 10002,
      "name": "연쇄 이벤트명",
      "desc": "설명",
      "options": [...]
    }
  }
]
```

- RLS: 모든 사용자 읽기 가능

---

### profiles (유저 프로필)

`auth.users` 확장. 신규 가입 시 트리거로 자동 생성.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, FK → auth.users(id) ON DELETE CASCADE | |
| `username` | TEXT | UNIQUE | 사용자명 |
| `avatar_url` | TEXT | | 프로필 이미지 URL |
| `bio` | TEXT | | 자기소개 |
| `role` | TEXT | DEFAULT `user` | 역할 (`user`, `admin`) |
| `suspended` | BOOLEAN | DEFAULT false | 정지 여부 |
| `preferred_lang` | VARCHAR(5) | NOT NULL, DEFAULT `ko` | 선호 언어 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

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
| `comment_count` | INT | DEFAULT 0 | 댓글 수 |
| `deck_code` | TEXT | | 편성 코드 |
| `lang` | VARCHAR(5) | NOT NULL, DEFAULT `ko` | 작성 언어 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 자동 갱신 트리거 |

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

---

### deck_egos (덱 EGO 편성)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `deck_id` | UUID | NOT NULL, FK → decks(id) ON DELETE CASCADE | |
| `ego_id` | UUID | NOT NULL, FK → ego(id) | |
| `grade` | TEXT | NOT NULL | EGO 등급 (`ZAYIN`~`ALEPH`) |

- UNIQUE: (`deck_id`, `ego_id`)
- RLS: 모든 사용자 읽기

---

### deck_votes (좋아요)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `deck_id` | UUID | PK(복합), FK → decks(id) ON DELETE CASCADE | |
| `user_id` | UUID | PK(복합), FK → profiles(id) ON DELETE CASCADE | |

- RLS: 모든 사용자 읽기, 로그인 유저만 추가/삭제

---

### deck_bookmarks (북마크)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `deck_id` | UUID | PK(복합), FK → decks(id) ON DELETE CASCADE | |
| `user_id` | UUID | PK(복합), FK → profiles(id) ON DELETE CASCADE | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기, 로그인 유저만 추가/삭제

---

### deck_comments (댓글)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `deck_id` | UUID | FK → decks(id) ON DELETE CASCADE | |
| `user_id` | UUID | FK → profiles(id) ON DELETE SET NULL | |
| `content` | TEXT | NOT NULL | 댓글 내용 |
| `parent_id` | UUID | FK → deck_comments(id) ON DELETE CASCADE | 대댓글 부모 (nullable) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기, 로그인 유저만 추가, 본인만 삭제

---

### identity_reviews (인격 리뷰)

인격당 1인 1리뷰 (개추/비추 + 한줄평).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `user_id` | UUID | NOT NULL, FK → profiles(id) ON DELETE CASCADE | |
| `is_positive` | BOOLEAN | NOT NULL | true=개추, false=비추 |
| `content` | TEXT | DEFAULT `''` | 한줄평 (최대 100자) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- UNIQUE: (`identity_id`, `user_id`)
- RLS: 모든 사용자 읽기, 로그인 유저 추가, 본인만 수정/삭제
- 인덱스: `identity_id`, `user_id`

---

### identity_guides (인격 운영법 가이드)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `identity_id` | UUID | NOT NULL, FK → identities(id) ON DELETE CASCADE | |
| `author_id` | UUID | NOT NULL, FK → profiles(id) | |
| `title` | TEXT | NOT NULL, DEFAULT `''` | 가이드 제목 |
| `content` | TEXT | NOT NULL, DEFAULT `''` | 가이드 본문 |
| `lang` | VARCHAR(5) | NOT NULL, DEFAULT `ko` | 작성 언어 |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 자동 갱신 트리거 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기

---

### announcements (공지사항)

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `title` | TEXT | NOT NULL | 공지 제목 |
| `content` | TEXT | NOT NULL, DEFAULT `''` | 공지 내용 |
| `pinned` | BOOLEAN | DEFAULT false | 상단 고정 여부 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | 자동 갱신 트리거 |

- RLS: 모든 사용자 읽기

---

### site_maintenance (점검 상태)

페이지별 점검 상태 관리. `proxy.ts`에서 점검 중인 경로 접근 시 `/maintenance`로 리다이렉트.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | SERIAL | PK | |
| `path` | TEXT | UNIQUE | 점검 대상 경로 (e.g. `/sinners`, `/decks`) |
| `label` | TEXT | | 관리 화면 표시명 |
| `message` | TEXT | | 점검 안내 메시지 |
| `reason` | TEXT | | 점검 사유 |
| `is_active` | BOOLEAN | DEFAULT false | 점검 활성화 여부 |
| `ends_at` | TIMESTAMPTZ | nullable | 점검 종료 예정 시각 |
| `updated_at` | TIMESTAMPTZ | | |

- RLS: 모든 사용자 읽기

---

### audit_logs (감사 로그)

관리자/운영진 활동 기록.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `actor_id` | UUID | FK → profiles(id) | 행위자 |
| `action` | TEXT | NOT NULL | 행위 유형 (`role_change`, `guide_create`, `suspend`, `deck_delete` 등) |
| `target_type` | TEXT | | 대상 유형 (`user`, `guide`, `deck`) |
| `target_id` | TEXT | | 대상 ID |
| `details` | JSONB | DEFAULT `{}` | 추가 정보 (이전값, 이후값 등) |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- RLS: 모든 사용자 읽기
- 인덱스: `created_at DESC`, `action`

---

### game_translations (게임 데이터 번역)

EN/JA 번역 오버레이 테이블. 원본 게임 데이터 테이블은 수정하지 않는다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | |
| `entity_type` | TEXT | NOT NULL | `identity`, `ego`, `skill`, `passive`, `keyword`, `ego_gift`, `buf` |
| `entity_id` | TEXT | NOT NULL | game_id, 키워드명, 또는 안정적인 문자열 키 |
| `lang` | VARCHAR(5) | NOT NULL | `en` 또는 `ja` (원본은 항상 `ko`) |
| `name` | TEXT | NOT NULL | 번역된 이름 |
| `description` | TEXT | | 번역된 설명 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

- UNIQUE: (`entity_type`, `entity_id`, `lang`)
- RLS: 모든 사용자 읽기, 쓰기는 service_role만

---

## ER 관계도 (텍스트)

```
sinners (1)──(N) identities (1)──(N) skills
                            (1)──(N) passives
                            (1)──(N) identity_sanity_conditions
                            (1)──(N) identity_reviews
                            (1)──(N) identity_guides

sinners (1)──(N) ego (1)──(N) ego_skills

profiles (1)──(N) decks (1)──(N) deck_identities ──(N:1) identities
                       (1)──(N) deck_egos ──(N:1) ego
                       (1)──(N) deck_votes ──(N:1) profiles
                       (1)──(N) deck_bookmarks ──(N:1) profiles
                       (1)──(N) deck_comments

mirror_dungeon_events ──(self) parent_id → mirror_dungeon_events

panic_types (1)──(N) identities
mental_condition_templates (1)──(N) identity_sanity_conditions
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

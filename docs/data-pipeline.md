# 데이터 파이프라인

SAIGO NO DANTE의 게임 데이터 동기화 파이프라인 문서.
게임 클라이언트 JSON을 1차 소스로 사용하여 Supabase DB에 동기화한다.

> **주의:** Namuwiki/baslimbus 데이터 소스 사용 금지. 게임 클라이언트 JSON만 1차 소스로 사용.

---

## 1차 데이터 소스

### 게임 클라이언트 JSON

| 경로 | 내용 | 비고 |
|------|------|------|
| `~/Documents/Limbus/assets/data/Json (Text)/` | 최신 게임 추출 데이터 | `.txt` 확장자, BOM 포함 |
| `~/Documents/Limbus/assets/data/Json (Text)/KR/` | KR 로케일 (패치별) | KR_*.txt |
| `~/Documents/Limbus/assets/data/Json-2/` | JSON 포맷 게임 데이터 | + KR 로케일 (KR_*.json) |
| `~/Documents/Limbus/assets/data/kr/` | 최신 KR 로케일 | 최신 패치 기준 |

**파일 포맷 주의사항:**
- `.txt` 파일은 JSON 형식이지만 BOM(Byte Order Mark)이 포함됨
- 읽을 때 반드시 `replace(/^\uFEFF/, '')` 처리 필요

### 주요 데이터 파일

| 파일 패턴 | 내용 |
|-----------|------|
| `personality-{NN}.txt` | 인격 스탯 (HP, 속도, 저항, skill/passive ID 목록) |
| `personality-skill-{NN}.txt` | 스킬 수치 (gaksungLevel 기반 업타이 분기) |
| `personality-passive-{NN}.txt` | 패시브 배정 (battlePassiveList/supporterPassiveList) |
| `passive.txt`, `passive_check4.txt` | 패시브 sin 코스트 (attributeStockCondition) |
| `ego-{N}.json` | EGO 데이터 |
| `ego-skill-{N}.json` | EGO 스킬 데이터 |
| `ego-gift-mirrordungeon*.json` | 거울 던전 EGO 기프트 |
| `mirrordungeon-theme-floor-t{1~6}.json` | 테마팩 데이터 |
| `mirrordungeon-theme-floor-hidden.json` | 히든 테마 데이터 |
| `mirror-dungeon-common-data-md7.json` | 기프트 조합 레시피 |
| `mirror-dungeon-action-choice-event.txt` | 거울 던전 선택 이벤트 |
| `mirror-dungeon-personality-choice-event.txt` | 거울 던전 인격 이벤트 |

### KR 텍스트 파일

| 파일 패턴 | 내용 |
|-----------|------|
| `KR_Personalities.json` | 인격 이름/타이틀 |
| `KR_Skills_personality-{NN}.json` | 스킬 텍스트 |
| `KR_Skills_Ego.json` | EGO 스킬 텍스트 |
| `KR_Passives.json` | 패시브 텍스트 + sin 코스트 |
| `KR_EGOgift_*.json` | 기프트 이름 매핑 (`dataList[].id` + `dataList[].name`) |
| `KR_ActionEvents_Mirror*.json` | 거울 던전 이벤트 텍스트 |
| `KR_AbEvents*.txt` | 이상현상 이벤트 텍스트 |
| `KR_UnitKeyword*.json`, `KR_AssociationName.json` | 유닛 태그/표시 소속 한글명 매핑 |
| `PersonalityVoiceDlg/KR_Voice_*.json` | 인격 획득 대사 `get_${gameId}_*` → `identities.quote` |
| `KR_MirrorDungeonTheme-1.txt` | 테마팩 이름 매핑 |
| `KR_BattleKeywords.json` | 전투 키워드 사전 |

---

## 동기화 스크립트

### 개요

| 스크립트 | 런타임 | 설명 | 대상 테이블 |
|----------|--------|------|-------------|
| `sync/identity-data.ts` | tsx | 인격/스킬/패시브/EGO 출시일 통합 동기화 (TypeScript+Zod) | `identities`, `skills`, `passives`, `ego.release_date` |
| `sync/mirror-dungeon-data.ts` | tsx | 거울 던전 전체 동기화 | `ego_gifts`, `ego_gift_themes`, `ego_gift_recipes`, `mirror_dungeon_events` |
| `sync/game-data.mjs` | Node.js | 인격 + EGO 스킬 동기화 | `skills`, `ego_skills` |
| `backfill-ego-release-dates.mjs` | Node.js | 로컬 게임 JSON `ego-*.txt`의 `updatedDate`로 EGO 출시일 백필 (dry-run 기본) | `ego.release_date` |
| `sync/translations.mjs` | Node.js | EN/JP 게임 텍스트 동기화 (스킬/패시브/키워드/기프트) | `game_translations`, `skills`, `passives` |
| `sync/wiki-namu.mjs` | Node.js | Namuwiki 레거시 동기화 (유지보수 전용) | `identities`, `ego`, `keyword_meta` |

### sync-mirror-dungeon-data.ts (거울 던전 통합 동기화)

TypeScript + Zod 기반 통합 동기화 스크립트. 4개 동기화 단계를 순차 실행.

```bash
npx tsx scripts/sync/mirror-dungeon-data.ts [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 비교만 수행 (기본값) |
| `--fix` | DB 자동 수정 |
| `--verbose` | 상세 로그 |
| `--gifts-only` | EGO 기프트만 동기화 |
| `--themes-only` | 테마팩만 동기화 |
| `--recipes-only` | 레시피만 동기화 |
| `--events-only` | 이벤트만 동기화 |

**동기화 단계:**

```
[1/4] EGO 기프트 동기화 (syncGifts)
  - ego-gift-mirrordungeon*.txt 로드
  - KR 이름 매핑 (KR_EGOgift_*.txt)
  - KR 효과 설명의 조건 문장에서 `activation_condition` 추출
    - 예: `... 공격 스킬을 보유한 인격이 5인 이상` → `{ type: "keyword", keyword, count: 5 }`
    - 예: `검계 소속 인격이 3인 이상` → `{ type: "affiliation", affiliation: "검계", count: 3 }`
    - 예: `혈찬을 소모하는 스킬을 보유한 인격이 3인 이상` → `{ type: "skill", skill_condition: "혈찬 소모", count: 3 }`
    - 추출 실패 시 기존 DB 값을 보존하며 null로 덮어쓰지 않음
  - DB upsert (ego_gifts)

[2/4] 테마팩 동기화 (syncThemes)
  - mirrordungeon-theme-floor-t{1~6}.txt 로드
  - KR/EN/JP 테마명 매핑 (`name`, `name_en`, `name_jp`)
  - floor_info 구성 (난이도별)
  - DB upsert (ego_gift_themes)

[3/4] 레시피 동기화 (syncRecipes)
  - mirror-dungeon-common-data-md7.txt → combineFixed 테이블
  - KR 기프트명 매핑
  - DB upsert (ego_gift_recipes)

[4/4] 이벤트 동기화 (syncEvents)
  - action/personality choice event 로드
  - KR 이벤트 텍스트 매핑 (KR_ActionEvents_Mirror*, KR_AbEvents*)
  - EN/JP 이벤트/선택지 텍스트 매핑 (ActionEvents/AbEvents)
  - 테마별 이벤트 매핑
  - 현재 테마팩 `eventPool`/`specialEventPool` root와 `nextEventID` child만 동기화 대상으로 사용
  - source 근거가 명확한 current-pool 중복 visible 이벤트는 canonical winner만 유지
  - 보상(rewards), `nextEventID`, result effects 추출 및 `md_event_choices.next_event_id/effects` 구성
  - 연쇄 child 이벤트는 카드 목록에서 숨기고 parent 이벤트 모달에서 `next_event_id`로 중첩 표시
  - DB 삽입 (dry-run 비교 기본, `--fix` 승인 후 반영)
```

### sync-game-data.mjs (인격 + EGO 스킬 동기화)

게임 클라이언트 JSON에서 스킬 수치를 추출하여 DB에 동기화.

```bash
node --env-file=.env.local scripts/sync/game-data.mjs [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 비교만 수행 (기본값) |
| `--fix` | DB 자동 수정 |
| `--sinner <slug>` | 특정 수감자만 동기화 |

**동기화 내용:**
- 인격 스킬: 업타이 3/4 각각 별도 row 삽입
- EGO 스킬: 해석 3/4, 각성/침식 각각 별도 row 삽입
- 코인 수, 위력, 스킬 타입, 죄악 속성 100% 정확 (게임 데이터 직접 추출)
- KR 스킬 텍스트: `KR/KR_Skills*.json`에서 매핑

> **주의:** 이 스크립트는 기존 DB에 존재하는 인격의 스킬만 sync한다. 신규 인격 row 자체를 생성하지 않는다.

### backfill-ego-release-dates.mjs (EGO 출시일 백필)

로컬 게임 JSON의 true EGO 파일(`ego-1.txt`, `ego-a1c9p3.txt` 등)에서 `updatedDate`를 읽어 `YYYY-MM-DD`로 변환하고, `limbus.ego.game_id` 기준으로 `release_date`를 비교한다. `ego-skill-*`, `ego-gift-*`, `ego-empty*` 계열은 출시일 소스가 아니므로 제외한다.

```bash
node --env-file=.env.local scripts/backfill-ego-release-dates.mjs --dry-run
node --env-file=.env.local scripts/backfill-ego-release-dates.mjs --fix
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 비교만 수행 (기본값) |
| `--fix` | DB 자동 수정. `limbus.ego.release_date` 마이그레이션 적용 후 승인받고 실행 |
| `--data-dir <path>` | 로컬 게임 JSON 경로 오버라이드 |

> **주의:** 이 스크립트는 dry-run 결과로 matched/changed/missing/ambiguous counts를 먼저 확인한 뒤에만 `--fix`를 실행한다.

### sync-wiki-namu.mjs (Namuwiki 레거시)

Namuwiki에서 인격/EGO 데이터를 추출. **신규 스크래핑 금지** - 기존 스크립트 유지보수만.

```bash
node --env-file=.env.local scripts/sync/wiki-namu.mjs --sinner ryoshu --dry-run
node --env-file=.env.local scripts/sync/wiki-namu.mjs --fix
```

**옵션:** `--sinner <slug>`, `--dry-run` (기본값), `--fix`, `--identity-only`, `--ego-only`, `--verbose`

---

## 시딩 스크립트

| 스크립트 | 설명 |
|----------|------|
| `seed/sinners.mjs` | 12 수감자 기본 데이터 |
| `seed/keyword-icons.mjs` | 키워드 icon_slug + sin_affinity 매핑 |
| `seed/spider-house-identities.mjs` | 신규 인격 삽입 템플릿 |

**실행:**
```bash
node --env-file=.env.local scripts/seed/sinners.mjs
```

---

## 데이터 흐름 다이어그램

### 인격/EGO 스킬 동기화

```
게임 클라이언트 추출
       │
       ▼
~/Documents/Limbus/assets/data/
├── Json (Text)/personality-skill-{NN}.txt    ─────┐
├── Json (Text)/ego-skill-{N}.json            ─────┤
├── Json (Text)/KR/KR_Skills_personality-*.txt ────┤
└── Json (Text)/KR/KR_Skills_Ego.txt          ─────┤
                                                    │
                                                    ▼
                                        sync-game-data.mjs
                                        (--dry-run → --fix)
                                                    │
                                                    ▼
                                        ┌───────────────────┐
                                        │  Supabase DB      │
                                        │  limbus.skills    │
                                        │  limbus.ego_skills│
                                        └───────────────────┘
```

### 거울 던전 동기화

```
게임 클라이언트 추출
       │
       ▼
~/Documents/Limbus/assets/data/Json (Text)/
├── ego-gift-mirrordungeon*.txt              ──── [1/4] 기프트
├── mirrordungeon-theme-floor-t{1~6}.txt     ──── [2/4] 테마팩
├── mirror-dungeon-common-data-md7.txt       ──── [3/4] 레시피
├── mirror-dungeon-*-choice-event.txt        ──── [4/4] 이벤트
└── KR/KR_ActionEvents_Mirror*.txt           ──── [4/4] 이벤트 텍스트
       │
       ▼
sync-mirror-dungeon-data.ts (npx tsx)
       │
       ▼
┌──────────────────────────────────────┐
│  Supabase DB                         │
│  limbus.ego_gifts                    │
│  limbus.ego_gift_themes              │
│  limbus.ego_gift_recipes             │
│  limbus.mirror_dungeon_events        │
└──────────────────────────────────────┘
```

### 신규 인격 추가 플로우

```
1. 패치 적용 후 데이터 추출
       │
       ▼
2. 신규 ID 확인 (KR_Personalities.json 비교)
       │
       ▼
3. 삽입 스크립트 실행 (seed-spider-house-identities.mjs 기반)
   --dry-run → --fix
       │
       ▼
4. 수동 필드 업데이트
   ├── acquisition (획득 방법 텍스트)
   ├── acquisition_info (JSONB)
   └── keywords (전체 추출 키워드 배열, 기존 인격은 --keywords 필요)
       │
       ▼
5. sync-game-data.mjs --fix (스킬 데이터 동기화)
       │
       ▼
6. 에셋 업로드 (이미지 파이프라인)
```

### sync-identity-data.ts (인격/스킬/패시브/EGO 출시일 통합 동기화)

TypeScript + Zod 기반 범용 인격 동기화 스크립트. 신규 인격 추가, 기존 인격 필드 업데이트, EGO 스킬/패시브 로케일 보강, EGO 출시일 비교/업데이트를 지원한다.

```bash
npx tsx scripts/sync/identity-data.ts [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 비교만 수행 (기본값) |
| `--fix` | DB 자동 수정 |
| `--sinner <slug>` | 특정 수감자만 처리 |
| `--verbose` | 상세 로그 |
| `--new-only` | 신규 인격만 표시/처리 |
| `--keywords` | 기존 인격 keywords 필드도 업데이트 |
| `--rebuild-keyword-meta` | keyword_meta 테이블 재구축 |

> **참고:** 이 스크립트가 `sync/game-data.mjs`의 상위 집합. 빈 DB라도 신규 인격 row, 인격 스킬, 패시브를 채우는 통합 경로로 사용할 것.
> EGO 출시일은 로컬 게임 JSON true EGO 파일의 `updatedDate`를 `YYYY-MM-DD`로 변환해 `ego.release_date`에 반영한다. `--dry-run`은 비교만 수행하고, `--fix`는 `limbus.ego.release_date` 마이그레이션 적용 후 승인받고 실행한다.

**인격 자동 동기화 계약:**
- `identities.skill_keyword_list`: `personality-*.txt`의 `skillKeywordList`를 `KR_BattleKeywords`/태그 매핑으로 번역한 공식 대표 스킬 키워드. 일반 스탯과 같이 `--dry-run`에서 diff를 보여주고 `--fix`에서 자동 반영한다.
- `identities.unit_keyword_list`: `personality-*.txt`의 `unitKeywordList`를 `KR_UnitKeyword` 매핑으로 번역한 유닛 태그 배열. E.G.O 기프트 조건 판정용으로 사용하며 소속 표시와 분리한다.
- `identities.association_list`: `personality-*.txt`의 `associationList`를 `KR_AssociationName`/`KR_UnitKeyword` 매핑으로 번역한 표시 소속 배열. 원본 순서를 보존한다.
- `identities.affiliation`: 기존 호환용 단일 대표 소속. `association_list`에서 `림버스 컴퍼니` 같은 broad base보다 `LCB`/`LCE`/`LCC`/`LCA` 등 구체 소속을 우선 선택한다.
- `identities.quote`: `PersonalityVoiceDlg/KR_Voice_*.json`의 첫 `get_${gameId}_*` 항목 `dlg`를 인격 획득 대사로 자동 반영한다. LCB 기본 인격을 포함해 소스 대사가 있으면 insert/update payload에 포함하며, 소스가 없는 경우 기존 DB 값을 null로 덮지 않는다.
- `identities.keywords`: `skillKeywordList`, `unitKeywordList`, `buffKeyword`, 패시브/스킬 본문 태그까지 모은 전체 키워드 매핑. 기존처럼 보호 필드이며, 기존 인격은 `--keywords`를 함께 줄 때만 업데이트한다.
- migration 적용 전 환경에서는 새 배열 컬럼 select가 실패하면 해당 컬럼을 제외하고 재시도해 dry-run 비교를 계속한다. 실제 반영은 `supabase/migrations/*_add_identity_skill_keyword_list.sql` 적용 후 실행한다.

### 덱 상시 키워드 백필

```bash
npx tsx scripts/backfill-deck-main-keywords.ts --dry-run
npx tsx scripts/backfill-deck-main-keywords.ts --fix
```

- 대상 컬럼: `decks.main_keywords` (`text[]`, 최대 5개, 고정 키워드 집합)
- 기본 백필은 편성 순서 1~7(`deck_identities.slot_order` 0~6)만 집계하며, 대기/미배정(`slot_order` 7~11/99)은 제외한다.
- 화상/파열/침잠/호흡/진동/충전/출혈은 `identities.skill_keyword_list`만 사용한다. `identities.keywords`는 넓은 추출 필드이므로 덱 상시 키워드 조건 판정에 사용하지 않는다.
- 참격/관통/타격은 허용된 `main_keywords` 값이지만 자동 백필/추천 집계에 포함하지 않는다. 이 세 키워드는 덱 빌더에서 사용자가 직접 선택한 경우에만 저장한다.
- `--fix`는 dry-run 결과 확인 후 사용자 승인받고 실행한다.

---

## 번역 동기화 스크립트

루트 `scripts/` 아래의 번역 전용 스크립트들. 각각 대상 테이블/컬럼이 다름.

| 스크립트 | 설명 | 대상 |
|----------|------|------|
| `sync/translations.mjs` | EN/JP 스킬/패시브/키워드/기프트 텍스트 → `game_translations` 및 `skills`/`passives` 직접 업데이트 | `game_translations`, `skills.name_en/jp`, `passives.name_en/jp` |
| `sync-game-translations.mjs` | EN/JP 로케일 파일 → `game_translations` upsert (CLI 필터 지원) | `game_translations` |
| `sync-keyword-translations.mjs` | `game_translations`에서 EN/JP 번역을 가져와 `keyword_meta` 컬럼 채움 | `keyword_meta.name_en/jp`, `description_en/jp` |
| `sync-name-translations.mjs` | EN/JP 인격/EGO/수감자 이름을 각 테이블에 직접 채움 | `identities.name_en/jp`, `ego.name_en/jp`, `sinners.name_jp` |

**번역 동기화 순서 (패치 후):**
```bash
# 1. 게임 텍스트 → game_translations
node --env-file=.env.local scripts/sync-game-translations.mjs --dry-run
node --env-file=.env.local scripts/sync-game-translations.mjs

# 2. keyword_meta 번역 채움
node --env-file=.env.local scripts/sync-keyword-translations.mjs --dry-run
node --env-file=.env.local scripts/sync-keyword-translations.mjs

# 3. 인격/EGO/수감자 이름 채움
node --env-file=.env.local scripts/sync-name-translations.mjs --dry-run
node --env-file=.env.local scripts/sync-name-translations.mjs
```

---

## 에셋 파이프라인

### 이미지 처리 흐름

```
Google Drive (원본 PNG)
       │
       ▼
sharp 라이브러리 (WebP 변환 + 리사이즈)
       │
       ▼
Supabase Storage (limbus-assets 버킷)
       │
       ▼
프론트엔드 (next/image 최적화)
```

### 에셋 업로드 스크립트

| 스크립트 | 설명 |
|----------|------|
| `upload/assets.mjs` | 범용 이미지 업로드 |
| `upload/keyword-icons.mjs` | 키워드 아이콘 업로드 |
| `upload/missing-assets.mjs` | 누락 에셋 탐지 및 업로드 |
| `upload/sinner-numbers.mjs` | 수감자 번호 이미지 업로드 |
| `upload/skill-icons.mjs` | 스킬 아이콘 업로드 |
| `scrape-keyword-icons.mjs` | Namuwiki에서 전용 키워드 아이콘 수집 + 업로드 |

### Google Drive 에셋 소스

| 용도 | 폴더 ID |
|------|---------|
| 인격/EGO 일러스트 | `1CW9wiMc5-KbTtFFSC2RNCWxQ3el6tN--` |
| 스킬 아이콘 | `1cPu9VqNXsrnYO22vLHqrOMudcpaFSDOo` |
| 키워드 아이콘 | `1yghkSHkQTH5ThEqOkfhr9Vc945GqC4lu` |
| 업로드 대기 | `1W3J6IK7Be80rE-JD0Dq2vXxh6ZUikfxB` |

### 인격/EGO 일러스트 폴더 구조

```
{Source}/Identities & EGO Art/{SinnerName}/Identities/{IdentityEnglishName}/
  ├── {gameId}_normal.png          → 기본 일러스트
  ├── {gameId}_gacksung.png        → 각성 일러스트
  ├── {gameId}_normal_info.png     → 카드 이미지 (기본)
  ├── {gameId}_gacksung_info.png   → 카드 이미지 (각성)
  ├── {gameId}_normal_profile.png  → 프로필 (기본)
  └── {gameId}_gacksung_profile.png → 프로필 (각성)
```

> T_*, BG.png 등 VFX/텍스처 파일은 웹앱에 불필요 - 무시.

---

## Supabase Storage 에셋 경로

Base URL: `https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets`

| 경로 패턴 | 설명 | 헬퍼 함수 |
|-----------|------|-----------|
| `icons/Rarity/{1star,2star,3star}.webp` | 등급 별 아이콘 | `RARITY_ICON_MAP[rarity]` |
| `icons/Rarity/{0,00,000}_frame.webp` | 등급 카드 프레임 | `RARITY_FRAME_MAP[rarity]` |
| `icons/Sins/transparent/{Wrath,...}.webp` | 7 죄악 아이콘 | `getSinIconUrl(sin)` |
| `icons/stats/{slash,pierce,blunt}.webp` | 공격 타입 아이콘 | `ATK_TYPE_ICON_MAP[type]` |
| `icons/keywords/{slug}.webp` | 키워드 아이콘 (200+) | `getKeywordIconUrl(keyword)` |
| `icons/Sinners/{sinnerId}.webp` | 수감자 로고 (12) | `getSinnerLogoUrl(sinnerId)` |
| `icons/skills/{sinnerId}/{gameId}{NN}.webp` | 스킬 아이콘 | `getSkillIconUrl(identity, idx)` |
| `icons/sd/{sinnerId}/{gameId}_idle.webp` | SD 스프라이트 | - |
| `icons/theme-packs/{packSpriteId}.webp` | 테마팩 선택 이미지 (380x690) | - |
| `icons/theme-packs/boss/{bossSpriteId}.webp` | 테마팩 보스 (391x432) | - |
| `ego-gifts/ego-gift-{hash}.webp` | 기프트 이미지 | `gift.image_url` (DB) |
| `sinners/{sinnerId}/identities/{folder}/{gameId}_normal.webp` | 인격 일러스트 (기본) | `getIdentityProfileUrl(identity)` |
| `sinners/{sinnerId}/identities/{folder}/{gameId}_gacksung.webp` | 인격 일러스트 (각성) | `getIdentityProfileUrl(identity, true)` |
| `sinners/{sinnerId}/identities/{folder}/{gameId}_normal_info.webp` | 카드 이미지 (기본) | `getIdentityInfoUrl(identity)` |
| `sinners/{sinnerId}/identities/{folder}/{gameId}_gacksung_info.webp` | 카드 이미지 (각성) | `getIdentityInfoUrl(identity, true)` |
| `sinners/{sinnerId}/ego/{folder}/` | EGO 이미지 폴더 | `getEGOImageUrl(sinnerId, folder)` |

> 이미지 URL은 반드시 `lib/utils/images.ts` 헬퍼 함수를 사용할 것. Supabase Storage URL을 컴포넌트에 직접 하드코딩하지 않는다.
> `STORAGE_BASE`는 `@/lib/constants/game`에서 import.

---

## 환경 변수

동기화 스크립트 실행에 필요한 환경 변수:

| 변수 | 용도 | 필수 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (RLS 바이패스) | 필수 |

스크립트 실행 시 `.env.local`에서 환경 변수를 로드:
```bash
# .mjs 스크립트
node --env-file=.env.local scripts/sync/game-data.mjs --dry-run

# .ts 스크립트 (dotenv 내장)
npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run
```

---

## 데이터 동기화 체크리스트 (패치 대응)

1. 게임 클라이언트에서 JSON 데이터 추출
2. `~/Documents/Limbus/assets/data/` 경로에 배치
3. 신규 인격 확인: `KR_Personalities.json` 비교
4. 신규 인격 삽입: 시딩 스크립트 (--dry-run 먼저)
5. 스킬 동기화: `scripts/sync/game-data.mjs --dry-run` → `--fix`
6. 거울 던전 동기화: `npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run` → `--fix`
7. 수동 필드 업데이트 (acquisition, acquisition_info 등). quote는 KR PersonalityVoiceDlg `get_*` 소스가 없는 인격만 검토
8. 에셋 업로드 (Google Drive → sharp → Supabase Storage)
9. 프론트엔드 확인

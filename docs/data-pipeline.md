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
| `KR_Skills_personality-{NN}.json` | 스킬 텍스트 (`desc`, `coinlist`, `flavor`) |
| `KR_Skills_Ego.json` | EGO 스킬 텍스트 |
| `KR_Passives.json` | 패시브 텍스트 + flavor + sin 코스트 |
| `KR_EGOgift_*.json` | 기프트 이름 매핑 (`dataList[].id` + `dataList[].name`) |
| `KR_ActionEvents_Mirror*.json` | 거울 던전 이벤트 텍스트 |
| `KR_AbEvents*.txt` | 이상현상 이벤트 텍스트 |
| `KR_UnitKeyword*.json`, `KR_AssociationName.json` | 유닛 태그/표시 소속 한글명 매핑 |
| `PersonalityVoiceDlg/KR_Voice_*.json` | 인격 획득 대사 `get_${gameId}_*` → `identities.quote` |
| `KR_MirrorDungeonTheme-1.txt` | 테마팩 이름 매핑 |
| `KR_BattleKeywords.json` | 전투 키워드 사전 |

---

## 동기화 스크립트

운영용 데이터 동기화 스크립트는 두 개만 유지한다. 둘 다 게임 클라이언트 JSON과 KR/EN/JP 로컬라이즈를 함께 읽으며, 기본 동작은 dry-run이다. `--fix` 실행은 dry-run 결과 확인 후 사용자 승인받고 수행한다.

| 스크립트 | 런타임 | 설명 | 대상 테이블 |
|----------|--------|------|-------------|
| `scripts/sync/identity-data.ts` | tsx | 인격 정보 전체 동기화. 인격 row, 인격 스킬, 패시브, EGO 스킬/패시브 로컬라이즈, EGO 출시일, 인격 획득처, 키워드 메타를 한 번에 처리 | `identities`, `skills`, `passives`, `ego`, `ego_skills`, `keyword_meta` |
| `scripts/sync/mirror-dungeon-data.ts` | tsx | 거던 데이터 전체 동기화. E.G.O 기프트, 테마팩, 레시피, 이벤트/선택지, KR/EN/JP 이름·설명을 한 번에 처리 | `ego_gifts`, `ego_gift_themes`, `ego_gift_recipes`, `md_events`, `md_event_choices` |

### identity-data.ts

```bash
npx tsx scripts/sync/identity-data.ts --dry-run
npx tsx scripts/sync/identity-data.ts --sinner yi-sang --dry-run
npx tsx scripts/sync/identity-data.ts --fix
```

주요 옵션:

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 비교만 수행. 기본값 |
| `--fix` | DB 반영 |
| `--sinner <slug>` | 특정 수감자만 처리 |
| `--verbose` | 상세 로그 |
| `--new-only` | 신규 인격 중심으로 확인 |
| `--ego-only` | EGO 스킬/패시브 로컬라이즈만 처리 |
| `--no-acquisition` | 인격 획득처 동기화 스킵 |
| `--rewrite-acquisition-text` | 획득처 텍스트까지 소스 기준으로 재작성 |
| `--no-enrich-gacha` | 가챠명 보강 스킵 |
| `--keywords` | 기존 인격 `keywords` 필드도 업데이트 |
| `--rebuild-keyword-meta` | `keyword_meta` 재구축 |

처리 범위:

- `KR/EN/JP_Personalities*`에서 `name_kr`, `name_en`, `name_jp` 구성
- `personality-*`, `personality-skill-*`, `personality-passive-*`에서 인격 스탯, 스킬, 패시브 구성
- `KR/EN/JP_Skills*`, `KR/EN/JP_Passive*`에서 스킬/패시브 이름, 설명, flavor 로컬라이즈 구성
- `KR/EN/JP_Skills_Ego*`, `KR/EN/JP_Passive_Ego*`에서 EGO 스킬/패시브 로컬라이즈 구성
- `ego-*` true EGO 파일의 `updatedDate`로 `ego.release_date` 구성
- `personality-*`, `gacha-*`, `*-event`, `KR/EN/JP_GachaTitle`, `KR_Items*`에서 `acquisition`/`acquisition_info` 구성
- `KR/EN/JP_BattleKeywords`, `Bufs`, `BuffAbilities`에서 키워드명/설명 보강
- `Json (Text)/*buff*.txt`의 `buffType`에서 `keyword_meta.effect_type` 구성
  - `Positive` → `positive` (스킬 설명 키워드 표시색 `#f8c200`)
  - `Negative` → `negative` (스킬 설명 키워드 표시색 `#e30000`)
  - `Neutral` → `neutral` (강제 색상 없이 기존 죄악/기본색 fallback)
  - 동일 한글명 후보가 여러 개면 display name이 아니라 실제 source tag 기준으로 먼저 해소한다.

### mirror-dungeon-data.ts

```bash
npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run
npx tsx scripts/sync/mirror-dungeon-data.ts --events-only --dry-run
npx tsx scripts/sync/mirror-dungeon-data.ts --fix
```

주요 옵션:

| 옵션 | 설명 |
|------|------|
| `--dry-run` | 비교만 수행. 기본값 |
| `--fix` | DB 반영 |
| `--verbose` | 상세 로그 |
| `--gifts-only` | E.G.O 기프트만 처리 |
| `--themes-only` | 테마팩만 처리 |
| `--recipes-only` | 레시피만 처리 |
| `--events-only` | 이벤트/선택지만 처리 |
| `--dump-events=<path>` | 이벤트 dry-run 타겟 JSON 덤프 |

처리 범위:

- `ego-gift-mirrordungeon*`와 KR/EN/JP `EGOgift*`에서 기프트/효과/로컬라이즈 구성
- `mirrordungeon-theme-floor-*`와 KR/EN/JP `MirrorDungeonTheme*`에서 테마팩/난이도/층/로컬라이즈 구성
- `mirror-dungeon-common-data-md7`에서 조합 레시피 구성
- `ActionEvents*`, `AbEvents*`, `choice-event`에서 이벤트/선택지/보상/`nextEventID` 구성
- 테마 이벤트는 루트 이벤트만 테마에 연결하고, 하위 이벤트와 known duplicate는 `variant_of`로 묶어 중복 노출을 방지

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
├── Json (Text)/KR/KR_Skills_personality-*.txt ────┤  desc/coinlist/flavor
└── Json (Text)/KR/KR_Skills_Ego.txt          ─────┤
                                                    │
                                                    ▼
                                        identity-data.ts (npx tsx)
                                        (--dry-run -> 승인 후 --fix)
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
mirror-dungeon-data.ts (npx tsx)
       │
       ▼
┌──────────────────────────────────────┐
│  Supabase DB                         │
│  limbus.ego_gifts                    │
│  limbus.ego_gift_themes              │
│  limbus.ego_gift_recipes             │
│  limbus.md_events                    │
│  limbus.md_event_choices             │
└──────────────────────────────────────┘
```

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
| `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (RLS 바이패스) | 필수 |

스크립트 실행 시 `.env.local`에서 환경 변수를 로드:
```bash
npx tsx scripts/sync/identity-data.ts --dry-run
npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run
```

---

## 데이터 동기화 체크리스트 (패치 대응)

1. 게임 클라이언트에서 JSON 데이터 추출
2. `~/Documents/Limbus/assets/data/` 경로에 배치
3. 신규 인격 확인: `KR_Personalities.json` 비교
4. 인격 전체 동기화: `npx tsx scripts/sync/identity-data.ts --dry-run` → 승인 후 `--fix`
5. 거던 전체 동기화: `npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run` → 승인 후 `--fix`
6. 필요한 이미지 에셋은 별도 수동 작업으로 Supabase Storage에 업로드하고 DB URL/정적 매핑을 확인
7. 프론트엔드 확인

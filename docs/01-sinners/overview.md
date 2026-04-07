# 수감자 / 인격 / E.G.O

## 페이지 라우트

| 경로 | 설명 |
|------|------|
| `/sinners` | 12 수감자 그리드 |
| `/sinners/[slug]` | 수감자 상세 (인격 목록 + E.G.O 목록) |
| `/sinners/[slug]/identities/[id]` | 인격 상세 (스킬, 패시브, 스탯, 정신력 조건) |
| `/sinners/[slug]/ego/[egoId]` | E.G.O 상세 |
| `/sinners/identities` | 전체 인격 목록 (전 수감자 통합) |
| `/sinners/ego` | 전체 E.G.O 목록 (전 수감자 통합) |

## DB 테이블

| 테이블 | 주요 컬럼 | 설명 |
|--------|-----------|------|
| `sinners` | id, name, slug | 12 수감자 기본 정보 |
| `identities` | id, sinner_id, name_kr, rarity, keywords, game_id, folder_name | 인격 정보 |
| `skills` | identity_id, uptie_level, variant_order, offense_level | 인격 스킬 (uptie 3/4 각각 별도 행) |
| `passives` | identity_id | 패시브 (전투/지원) |
| `ego` | id, sinner_id, name, grade, sin_affinity, cost, image_url | E.G.O 정보 |
| `ego_skills` | ego_id, category, construe_level | E.G.O 스킬 (각성/침식) |
| `keyword_meta` | name, description, max_stack, icon_slug, sin_affinity | 키워드 메타 정보 |
| `identity_sanity_conditions` | identity_id, template_id, condition_type, params, sort_order | 정신력 증감 조건 |
| `mental_condition_templates` | id, add_text, min_text | 정신력 조건 텍스트 템플릿 |
| `panic_types` | id, name, description | 패닉 유형 (e.g. 패닉) |

## 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `SinnerCard` | `components/sinners/SinnerCard.tsx` | 수감자 그리드 카드 |
| `IdentityCard` | `components/sinners/IdentityCard.tsx` | 인격 카드 (프레임, 등급, 키워드 뱃지, GSAP 호버) |
| `KeywordTooltip` | `components/sinners/KeywordTooltip.tsx` | 키워드 툴팁 |
| `IdentityDetailModal` | `components/ui/IdentityDetailModal.tsx` | 인격 상세 모달 |
| `IdentityDecksTab` | `components/sinners/IdentityDecksTab.tsx` | 인격 상세 내 덱 탭 |
| `SkillIcon` | `components/identity/SkillIcon.tsx` | 스킬 아이콘 이미지 |
| `KeywordChip` | `components/ui/KeywordChip.tsx` | 키워드 뱃지 (아이콘 + 이름, 자동 색상) |
| `SinBadge` | `components/ui/SinBadge.tsx` | 죄악 유형 뱃지 |
| `KeywordProvider` | `components/providers/KeywordProvider.tsx` | 키워드 메타 글로벌 컨텍스트 |

## 사용자 흐름

### 수감자 목록 -> 수감자 상세

1. `/sinners` 페이지에서 12명의 수감자를 그리드 형태로 확인
2. 수감자 카드(`SinnerCard`) 클릭 시 `/sinners/[slug]`로 이동
3. 수감자 상세 페이지에서 해당 수감자의 인격 목록과 E.G.O 목록을 확인

### 인격 상세

1. 수감자 상세 페이지에서 인격 카드(`IdentityCard`) 클릭
2. `/sinners/[slug]/identities/[id]` 페이지로 이동
3. 인격 상세 정보 확인:
   - **동기화(uptie) 3/4 토글**: 스킬 데이터가 uptie_level 3과 4로 각각 별도 행으로 저장되어 있으며, 토글로 전환
   - **스킬 코인 시각화**: 각 스킬의 코인 수, 위력, 공격 레벨 표시. `offense_level`은 DB에 `60 + 보정값`으로 저장되어 프론트엔드에서 `offense_level - 60`으로 보정치 표시
   - **패시브 (전투/지원)**: 전투 패시브와 지원 패시브를 구분하여 표시
   - **내성 차트**: 각 죄악 유형별 내성 정보
   - **정신력 조건**: `identity_sanity_conditions` + `mental_condition_templates` 조합으로 정신력 증감 조건 표시. 템플릿의 `{0}`, `{1}` 플레이스홀더를 `params` 배열 값으로 치환
   - **인격 사용 덱 탭**: `IdentityDecksTab`으로 해당 인격이 포함된 커뮤니티 덱 목록 표시

### E.G.O 상세

1. 수감자 상세 페이지에서 E.G.O 항목 클릭
2. `/sinners/[slug]/ego/[egoId]` 페이지로 이동
3. E.G.O 상세 정보 확인:
   - **각성(awakening) / 침식(corrosion) 스킬**: `ego_skills.category`로 구분
   - **해석(construe) 3/4 토글**: `construe_level` 3과 4 전환
   - **죄악 내성 (7종)**: 7가지 죄악 유형별 내성 수치
   - **죄악 비용 (7종)**: E.G.O 사용에 필요한 각 죄악 자원 비용

### 전체 인격/E.G.O 목록

1. `/sinners/identities` — 전체 수감자의 인격을 통합 조회
2. `/sinners/ego` — 전체 수감자의 E.G.O를 통합 조회
3. 수감자 상세 페이지(`/sinners`)의 바로가기 링크를 통해 접근 가능

## 검색 및 필터

- **수감자별 필터**: 특정 수감자의 인격/E.G.O만 조회
- **키워드 필터**: 전투 키워드(출혈, 진동 등)로 필터링
- **등급 필터**: 인격 등급(1~3성)별 필터링
- **소속 필터**: 소속 조직별 필터링

## 이미지 에셋 경로

Supabase Storage (`limbus-assets` 버킷) 기준:

| 유형 | 경로 패턴 |
|------|-----------|
| SD 스프라이트 | `icons/sd/{sinner_id}/{game_id}_idle.webp` |
| 스킬 아이콘 | `icons/skills/{sinner_id}/{skillId}.webp` |
| 인격 이미지 | `sinners/{sinner_id}/identities/{folder_name}/{game_id}_normal.webp` |
| 등급 아이콘 | `icons/Rarity/{n}star.webp` |
| 죄악 아이콘 | `icons/sin/{sin}.webp` |

## 스킬 데이터 구조

- `uptie_level`: 동기화 레벨 (3 또는 4). 같은 스킬이 레벨별로 별도 행
- `variant_order`: 삽입 순서 (프론트엔드 표시 순서 보장)
- `offense_level`: 공격 레벨 (`60 + skillLevelCorrection`). 프론트엔드에서 `offense_level - 60`을 보정치로 표시
- 스킬 순서: S1, S2, S3, S3-2(변형), 방어 스킬(skill_order 4)

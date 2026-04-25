# 거울 던전 (Mirror Dungeon)

## 페이지 라우트

| 경로 | 설명 |
|------|------|
| `/mirror-dungeon` | 거울 던전 E.G.O 기프트 백과사전 |

## DB 테이블

| 테이블 | 주요 컬럼 | 설명 |
|--------|-----------|------|
| `ego_gifts` | id, name, keyword, grade, tier, enhancement, price, sell_price, buy_disabled, effect_base/plus/plusplus, activation_condition, is_synthesis, image_url, game_id, difficulty, acquisition | E.G.O 기프트 (400+개) |
| `ego_gift_themes` | id, name, name_en/name_jp, dungeon_id, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info | 테마 팩 정보 |
| `ego_gift_recipes` | (재료 3개 -> 결과 1개) | 기프트 조합 레시피 |
| `md_events` | id, name/name_en/name_jp, desc_text/desc_text_en/desc_text_jp, event_type, theme_ids, gift_ids, variant_of | 거울 던전 이벤트 본문 |
| `md_event_choices` | event_id, sort_order, message/message_en/message_jp, message_desc/message_desc_en/message_desc_jp, result_text/result_text_en/result_text_jp, next_event_id, effects | 이벤트 선택지와 연쇄 이벤트/보상 |
| `keyword_meta` | name, description, max_stack, icon_slug, sin_affinity | 키워드 메타 정보 |

## 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `GiftCard` | `components/ui/GiftCard.tsx` | 통합 팔각형 기프트 카드. Props: `gift`, `onClick`, `isSelected`, `enhance`, `onRemove`, `conditionStatus` |
| `GiftModal` | (거울 던전 내부) | 기프트 상세 모달 (효과, 조합, 획득처) |
| `ThemePackCard` | `components/ui/ThemePackCard.tsx` | 테마 팩 카드 (이미지, 보스, 이름). Props: `theme`, `onClick`, `isSelected`, `showGiftCount` |
| `ThemeModal` | (거울 던전 내부) | 테마 팩 상세 모달 |
| `BaseModal` | `components/ui/BaseModal.tsx` | 모달 래퍼 (ESC, 스크롤 잠금, 배경 블러) |
| `KeywordChip` | `components/ui/KeywordChip.tsx` | 키워드 뱃지 |
| `SearchModal` | `components/ui/SearchModal.tsx` | 글로벌 검색 (Cmd+K) |

## 기프트 등급 체계

| 등급 | 설명 |
|------|------|
| 1 | 일반 (최저) |
| 2 | 고급 |
| 3 | 희귀 |
| 4 | 최고급 |
| EX | 특수 (테마 팩 전용 등) |

## 기프트 강화 시스템

기프트는 최대 2단계까지 강화 가능하며, 강화 단계에 따라 다른 효과 텍스트를 표시:

| 강화 레벨 | DB 컬럼 | 표시명 |
|-----------|---------|--------|
| 0 (기본) | `effect_base` | 기본 효과 |
| 1 (강화+) | `effect_plus` | 강화+ |
| 2 (강화++) | `effect_plusplus` | 강화++ |

강화 단계별로 대상 편성 슬롯이 달라질 수 있음 (예: 기본은 6번 슬롯, 강화++은 1번과 6번 슬롯).

## 활성 조건 (activation_condition)

기프트 활성 조건은 JSONB로 저장되며 다음 유형이 존재:

| type | 필드 | 설명 |
|------|------|------|
| `keyword` | `keyword`, `count` | 특정 키워드 보유 인격 N명 이상 |
| `multi_keyword` | `keywords`, `count` | 복수 키워드 중 하나 보유 인격 N명 이상 |
| `affiliation` | `affiliation`/`affiliations`, `count` | 특정 소속 인격 N명 이상 |
| `skill` | (스킬 조건) | 특정 스킬 타입 조건 |

강화 효과 전용 기프트(전격부, 거울 속의 꽃 등)는 `activation_condition`이 `NULL`.

## 테마 팩

### 구조

- `id`: 게임 데이터 기반 ID (1001~1510)
- `ego_gift_ids`: 소속 기프트 game_id 배열
- `specific_ego_gift_ids`: 전용 기프트 game_id 배열 (해당 테마에서만 획득 가능)
- `difficulty`: `normal` | `hard` | `extreme`
- `floor_info`: 층 출현 정보 (JSONB)

### 난이도별 출현 층

`floor_info` JSONB 구조:

```json
{
  "노말": [1, 2, 3],
  "하드": [1, 2],
  "평행중첩": [10]
}
```

| 던전 유형 | dungeonIdx | 설명 |
|-----------|------------|------|
| 노말 | 0 | 일반 난이도 |
| 하드 | 1 | 어려움 |
| 평행중첩 | 2 | 하드 10층 특수 |
| 익스트림 | 3 | 최고 난이도 |

### 이미지 에셋

| 유형 | 경로 패턴 |
|------|-----------|
| 테마 팩 선택 이미지 | `icons/theme-packs/{packSpriteId}.webp` (380x690) |
| 보스 이미지 | `icons/theme-packs/boss/{bossSpriteId}.webp` (391x432) |
| 기프트 이미지 | `ego-gifts/ego-gift-{hash}.webp` |
| 키워드 아이콘 | `icons/keywords/{slug}.webp` |

## 레시피 (조합)

고정 조합: 재료 기프트 3개를 합성하여 결과 기프트 1개를 획득.
`is_synthesis` 플래그로 합성 기프트 여부 구분.

## 이벤트

거울 던전 진행 중 발생하는 이벤트:

- **행동 선택 이벤트**: 선택지에 따라 다른 보상
- **인격 선택 이벤트**: 특정 인격 보유 시 추가 선택지
- **중첩 이벤트**: 이벤트 내에서 추가 이벤트 분기 (parent_id로 연결)
- **보상**: 기프트, 코스트, 체력 회복 등

## 사용자 흐름

### 기프트 백과사전 탐색

1. `/mirror-dungeon` 페이지 접근
2. 408개 이상의 기프트를 그리드 형태로 확인
3. 필터 옵션으로 원하는 기프트 검색:
   - **키워드 필터**: 전투 키워드별 필터링
   - **등급 필터**: 1~4등급, EX 필터링
   - **난이도 필터**: 노말/하드/익스트림 구분
   - **검색**: 기프트 이름 텍스트 검색
4. 기프트 카드(`GiftCard`) 클릭 시 상세 모달 표시
5. 모달에서 효과 텍스트, 활성 조건, 조합 레시피, 획득처 확인

### 테마 팩 뷰

1. 테마 팩 탭으로 전환
2. `ThemePackCard`로 테마 팩 목록 확인 (보스 이미지, 이름, 난이도)
3. 테마 팩 클릭 시 `ThemeModal`로 상세 정보 표시:
   - 소속 기프트 목록
   - 전용 기프트 목록
   - 출현 층 정보 (난이도별)

### 레시피 브라우저

1. 레시피 탭으로 전환
2. 합성 가능한 기프트 조합 목록 확인
3. 재료 기프트 3개 -> 결과 기프트 1개 매핑 확인

### 이벤트 브라우저

1. 이벤트 탭으로 전환
2. 거울 던전 이벤트 목록 탐색
3. 이벤트별 선택지, 보상, 중첩 이벤트 확인
4. `md_event_choices.next_event_id`로 연결된 child dialogue event는 독립 카드가 아니라 parent 이벤트 상세 모달 안에 표시

## API 라우트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/ego-gifts` | GET | E.G.O 기프트 목록 + activation_condition (`force-dynamic`) |
| `/api/keyword-meta` | GET | 키워드 설명 정보 |
| `/api/search` | GET | 글로벌 검색 (E.G.O 기프트 포함) |

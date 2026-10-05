# 개발자 API와 협업 파트너

`/api/v1`의 자원, 한도, 응답 형식과 협업 파트너(Discord 봇) 연동 방법이다. 표와 권한은 [데이터 모델](data-model.md)의 "개발자 API와 관심도"에 있다.

## 인증과 한도

모든 요청은 `Authorization: Bearer lmb_…` 헤더가 필요하다. 키는 개발자 도구(`/developers`)에서 발급한다.

| 계정 | 분당 | 하루 | `X-RateLimit-Remaining` |
|---|---|---|---|
| 일반 | 60회 | 10,000회 | 하루 남은 횟수 |
| 파트너 | 600회(폭주 방지용 상한) | 제한 없음 | 없음 |

한도를 넘으면 429와 `Retry-After`(초)를 준다. 파트너 등급은 키가 아니라 계정에 붙는다. 관리자 화면의 유저 관리에서 지정하고, 키를 재발급해도 유지된다. 파트너 요청도 `developer_usage`에 집계한다.

## 자원

| 자원 | 대상 | 내용 |
|---|---|---|
| `decks`, `planners` | 모든 키 | 공개 덱·플랜 목록. `limit`(1–50), `offset`, `q`(제목 검색), `sort`(`recent` 기본, `popular`), `id` |
| `identities` | 파트너 | 인격 전체. `id`를 주면 스킬·패시브 포함 |
| `egos` | 파트너 | E.G.O 전체. `id`를 주면 스킬·패시브 포함 |
| `ego-gifts` | 파트너 | 기프트 전체(효과 3단계 포함). `id`는 UUID나 게임 ID |
| `theme-packs` | 파트너 | 테마팩 전체(층 정보, 기프트 ID 목록) |
| `md-events` | 파트너 | 거울 던전 이벤트 전체. 선택지는 `choices` |
| `keywords` | 파트너 | 키워드 전체. `key`가 다른 자원의 `keywords`·`keyword` 값과 맞는 한국어 이름 |

일반 키가 파트너 자원을 요청하면 403 `Partner access required`다.

공통 규칙:

- `lang`은 `ko`(기본), `en`, `ja`. 이름·설명 칸은 고른 언어 하나만 `name`, `description`처럼 내려가고, 번역이 비어 있으면 한국어다.
- 응답은 항상 `{ "data": [...] }`다. `id`로 찾지 못하면 빈 배열이다.
- 게임 자원 목록은 한 번에 전부 내려간다(가장 큰 `md-events`가 약 750KB). 게임 데이터는 패치 때만 바뀌므로 봇은 목록을 받아 메모리에 두고 주기적으로 새로 받는 방식을 쓴다. Discord 자동완성은 이 캐시에서 찾는다.
- `sin_affinity`, `atk_type`, `skill_type`은 영어 코드(`wrath`, `slash`, `evade` …)다. 내성(`slash_res`, `resistance`), 키워드, 소속은 게임 원문 한국어 값이다.
- 인격·E.G.O에는 `url`(사이트 상세)과 `card_url`(OG 카드 이미지, 1200×630)이 붙는다. 이미지 주소는 인증 없이 열린다.

## 파트너 덱·플랜 상세

파트너 키로 `decks?id=<uuid>`나 `planners?id=<uuid>`를 요청하면 목록 형식 대신 아래 형식을 준다. 목록(`id` 없음)에는 `url`과 `card_url`만 더 붙는다.

```json
{
  "id": "…", "title": "…", "lang": "ko", "vote_count": 12,
  "url": "https://saigo-no-dante.com/ko/decks/…",
  "card_url": "https://saigo-no-dante.com/ko/decks/…/opengraph-image",
  "formation": [
    {
      "slot_order": 0,
      "uptie": 4,
      "skill_counts": [3, 2, 1],
      "identity": { "id": "…", "name": "…", "sinner_id": "ryoshu", "rarity": 3, "image_url": "…", "url": "…",
        "resistances": { "slash": "내성", "pierce": "취약", "blunt": "보통" } },
      "skills": [
        { "skill_order": 1, "variant_order": 1, "name": "…", "skill_type": "slash", "atk_type": "slash",
          "sin_affinity": "lust", "coins": 3, "base_power": 3, "coin_power": 3, "offense_level": 62, "atk_weight": 1, "icon_url": "…" }
      ]
    }
  ],
  "egos": [{ "id": "…", "grade": "ZAYIN", "name": "…", "sinner_id": "…", "sin_affinity": "sloth", "image_url": "…", "cost": [0, 0, 2, 0, 0, 1, 0], "url": "…" }],
  "analysis": {
    "attack_types": { "slash": 45, "pierce": 6, "blunt": 31 },
    "defense_types": { "evade": 6, "defense": 5, "counter": 8 },
    "sin_production": { "wrath": 6, "lust": 17, "sloth": 8, "gluttony": 8, "gloom": 9, "pride": 16, "envy": 8 },
    "ego_cost": { "wrath": 7, "lust": 12, "sloth": 8, "gluttony": 2, "gloom": 12, "pride": 6, "envy": 9 }
  }
}
```

- `formation`은 편성 순서(`slot_order` 오름차순)다. `99`는 순서를 정하지 않은 인격이다.
- `skills`는 그 칸의 동기화 단계(`uptie`)에 해당하는 스킬만 담는다. `skill_order` 1–3이 스킬 1–3, 4가 수비 스킬이고 `variant_order`가 다른 줄은 변형 스킬이다. 스킬 설명은 `identities?id=`에서 받는다.
- `skill_counts`는 스킬 1·2·3의 분배 개수다. `cost`와 `ego_cost`의 죄악 순서는 분노·색욕·나태·탐식·우울·오만·질투다.
- `analysis`는 사이트의 덱·플랜 화면과 같은 계산(`lib/decks/deck-analysis.ts`)이다.

플랜은 여기에 다음이 더 붙는다.

- `floors`: 층별 `floor`, `difficulty`, `memo`, `constraints`, `theme`(`id`, `name`, `image_url`), `gifts`(`game_id`, `name`, `grade`, `keyword`, `image_url`).
- `gift_inventory`: 보유 기프트. `source`는 `start`(시작), `observe`(관측), `final`(최종)이고 옛 플랜은 `null`이다. `enhancement`는 0–2.
- `blessings`: 가호의 `id`와 `level`.

## Discord 응답 구성

- 카드 이미지는 사이트가 그린다. 봇은 `card_url`을 Embed의 `image.url`에 넣는다. Discord가 인증 없이 받아 가서 캐시한다.
- Embed 제목은 `url`로 연결하고, 푸터에 출처("최애의 관리자 · saigo-no-dante.com")를 적는다.
- 죄악·공격 유형처럼 작은 아이콘은 봇의 애플리케이션 이모지로, 편성이나 목록처럼 큰 것은 이미지로 보낸다.
- 응답 구성에 3초 넘게 걸릴 수 있으면 먼저 응답을 미룬(defer) 뒤 채운다.

## 코드 위치

| 역할 | 파일 |
|---|---|
| 라우트(인증, 한도, 분기) | `app/api/v1/[resource]/route.ts` |
| 응답 구성(언어 선택, 주소, 편성·집계) | `lib/developer/partner-api.ts` |
| 조회(게임 자원은 `'use cache'`, 게임 데이터 태그로 무효화) | `lib/developer/partner-data.ts` |
| 한도와 파트너 지정 함수 | `supabase/migrations/20261005150000_developer_partner.sql` |
| 검사 | `tests/lib/developer-partner-api.test.ts`, `tests/api/developer-v1-partner.test.ts`, `tests/sql/developer-partner.sql`, `e2e/developer-api.acceptance.cjs` |

자원을 더할 때는 `partner-api.ts`의 `RESOURCES`와 `partner-data.ts`의 `CATALOGS`에 한 줄씩 넣는다.

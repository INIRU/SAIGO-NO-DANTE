# 개발자 API와 협업 파트너

`/api/v1`의 자원, 한도, 응답 형식, 파트너 권한, 소식 보내기 양식이다. 개발자가 보는 설명과 요청 테스트는 개발자 도구(`/developers`)에 있다. 표와 권한은 [데이터 모델](data-model.md)의 "개발자 API와 관심도"에 있다.

## 인증과 한도

모든 요청은 `Authorization: Bearer lmb_…` 헤더가 필요하다. 키는 개발자 도구(`/developers`)에서 발급한다.

| 계정 | 분당 | 하루 | `X-RateLimit-Remaining` |
|---|---|---|---|
| 일반 | 60회 | 10,000회 | 하루 남은 횟수 |
| 파트너 | 600회(폭주 방지용 상한) | 제한 없음 | 없음 |

한도를 넘으면 429와 `Retry-After`(초)를 준다. 파트너 요청도 `developer_usage`에 집계한다.

## 파트너와 권한

파트너는 `limbus.partners`의 한 줄이다(코드, 이름, 권한 목록). 계정의 `profiles.partner`가 그 코드를 가리키므로 키를 재발급해도 유지된다. 관리자 화면의 유저 상세에서 목록에서 골라 지정한다. 파트너를 새로 만들거나 권한을 바꾸는 화면은 없고 마이그레이션으로 넣는다.

| 권한 | 할 수 있는 것 |
|---|---|
| `catalog:read` | 게임 데이터 자원, 덱·플랜 상세 |
| `news:write` | 소식 보내기와 지우기 |

림피(Discord 봇)는 코드 `limpi`이고 두 권한을 모두 가진다. 관리자 계정(역할 또는 `ADMIN_EMAILS`)의 키는 개발자 도구를 확인할 수 있도록 게임 데이터 조회와 소식 시험 전송까지 된다. 소식을 실제로 저장하거나 지우는 것은 파트너 계정의 키만 한다.

## 자원

| 자원 | 대상 | 내용 |
|---|---|---|
| `decks`, `planners` | 모든 키 | 공개 덱·플랜 목록. `limit`(1–50), `offset`, `q`(제목 검색), `sort`(`recent` 기본, `popular`), `id` |
| `identities` | `catalog:read` | 인격 전체. `id`를 주면 동기화 1~4 단계의 스킬·패시브를 모두 포함(줄마다 `uptie_level`) |
| `egos` | `catalog:read` | E.G.O 전체. `id`를 주면 스킬·패시브 포함 |
| `ego-gifts` | `catalog:read` | 기프트 전체(효과 3단계 포함). `id`는 UUID나 게임 ID |
| `theme-packs` | `catalog:read` | 테마팩 전체(층 정보, 기프트 ID 목록) |
| `md-events` | `catalog:read` | 거울 던전 이벤트 전체. 선택지는 `choices` |
| `keywords` | `catalog:read` | 키워드 전체. `key`가 다른 자원의 `keywords`·`keyword` 값과 맞는 한국어 이름 |

`catalog:read`가 없는 키가 이 자원을 요청하면 403 `Partner access required`다.

공통 규칙:

- `lang`은 `ko`(기본), `en`, `ja`. 이름·설명 칸은 고른 언어 하나만 `name`, `description`처럼 내려가고, 번역이 비어 있으면 한국어다.
- 응답은 항상 `{ "data": [...] }`다. `id`로 찾지 못하면 빈 배열이다.
- 게임 자원 목록은 한 번에 전부 내려간다(가장 큰 `md-events`가 약 750KB). 게임 데이터는 패치 때만 바뀌므로 봇은 목록을 받아 메모리에 두고 주기적으로 새로 받는 방식을 쓴다. Discord 자동완성은 이 캐시에서 찾는다.
- `sin_affinity`, `atk_type`, `skill_type`은 영어 코드(`wrath`, `slash`, `evade` …)다. 내성(`slash_res`, `resistance`), 키워드, 소속은 게임 원문 한국어 값이다.
- 2026-10-29부터 값이 없던 칸이 응답에서 빠졌다: E.G.O의 `description`·`corrosion_risk`·`obtaining_method*`, 기프트의 `acquisition`·`related`, 키워드의 `sin_affinity`. 인격·E.G.O의 `name`은 그대로 내려간다(`name_kr`·`name_en`·`name_jp`를 고른 언어 하나로 합친 값).
- 인격·E.G.O에는 `url`(사이트 상세)과 `card_url`(OG 카드 이미지, 1200×630)이 붙는다. 이미지 주소는 인증 없이 열린다.

## 파트너 덱·플랜 상세

`catalog:read`가 있는 키로 `decks?id=<uuid>`나 `planners?id=<uuid>`를 요청하면 목록 형식 대신 아래 형식을 준다. 목록(`id` 없음)에는 `url`과 `card_url`만 더 붙는다.

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

- `formation`은 편성 전원을 편성 순서(`slot_order` 오름차순)대로 담는다. 위 예시는 한 명만 적었다. `99`는 순서를 정하지 않은 인격이다.
- `skills`는 그 칸의 동기화 단계(`uptie`)에 해당하는 스킬만 담는다. `skill_order` 1–3이 스킬 1–3, 4가 수비 스킬이고 `variant_order`가 다른 줄은 변형 스킬이다. 스킬 설명과 다른 동기화 단계의 스킬은 `identities?id=`에서 받는다(1~4 단계 전부, `uptie_level`로 구분. 1·2단계에는 스킬 3이, 1단계에는 패시브가 없는 인격이 많다).
- `skill_counts`는 스킬 1·2·3의 분배 개수다. `cost`와 `ego_cost`의 죄악 순서는 분노·색욕·나태·탐식·우울·오만·질투다.
- `analysis`는 사이트의 덱·플랜 화면과 같은 계산(`lib/decks/deck-analysis.ts`)이다.

플랜은 여기에 다음이 더 붙는다.

- `floors`: 층별 `floor`, `difficulty`, `memo`, `constraints`, `theme`(`id`, `name`, `image_url`), `gifts`(`game_id`, `name`, `grade`, `keyword`, `image_url`).
- `gift_inventory`: 보유 기프트. `source`는 `start`(시작), `observe`(관측), `final`(최종)이고 옛 플랜은 `null`이다. `enhancement`는 0–2.
- `blessings`: 가호의 `id`와 `level`.

## 소식 보내기

`news:write`가 있는 키로 `POST /api/v1/news`를 보내면 캘린더(`/calendar`)에 소식이 올라간다. 한 요청에 ko·en·ja 내용을 함께 담는다.

```json
{
  "id": "x:1975411111111111111",
  "feed": "hampang",
  "platform": "x",
  "category": "notice",
  "published_at": "2026-10-06T10:00:00+09:00",
  "starts_at": null,
  "ends_at": null,
  "spoiler": false,
  "author": { "name": "햄햄팡팡", "handle": "Ham_PangPang" },
  "content": {
    "ko": {
      "title": "…", "body": "…", "url": "https://x.com/Ham_PangPang/status/…",
      "media": [
        { "type": "image", "url": "https://pbs.twimg.com/media/….jpg" },
        { "type": "youtube", "id": "dQw4w9WgXcQ" },
        { "type": "video", "url": "https://x.com/…/video/1", "thumbnail": "https://pbs.twimg.com/….jpg" }
      ]
    },
    "en": { "title": "…", "translated": true }
  }
}
```

| 칸 | 규칙 |
|---|---|
| `id` | 필수, 1–120자. 파트너 안에서 고유. 같은 `id`를 다시 보내면 통째로 덮어쓴다. 언어를 뺀 값: `steam:{gid}`, `x:{tweet_id}`, `youtube:{video_id}` |
| `feed` | 필수. `limbus`, `project_moon`, `hampang` |
| `platform` | 필수. `steam`, `x`, `youtube`, `chzzk`, `partner`(봇이 직접 만든 알림) |
| `category` | 기본 `notice`. `update`, `maintenance`, `event`, `video`, `live` |
| `published_at` | 필수. 시간대가 붙은 ISO 8601. 캘린더 날짜는 한국 시간으로 나눈다 |
| `starts_at`, `ends_at` | 선택. 방송은 끝난 뒤 같은 `id`에 `ends_at`을 채워 다시 보낸다 |
| `spoiler` | 기본 `false`. `true`면 매체를 가린다 |
| `author` | 선택. `name`(필수), `handle`, `url` |
| `content` | 필수. `ko`, `en`, `ja` 중 하나 이상. 없는 언어는 ko, en, ja 순으로 대신 보여 준다 |
| `content.*.title` | 필수, 1–200자 |
| `content.*.body` | 4,000자 이하 일반 텍스트 |
| `content.*.url` | 선택. 원문 주소(https) |
| `content.*.media` | 10개 이하. `image`(주소), `youtube`(영상 ID 11자), `video`(원문 주소와 선택 `thumbnail`) |
| `content.*.translated` | 기본 `false`. 기계 번역이면 `true` |

- 이미지와 `thumbnail`은 https이고 `steamstatic.com`, `twimg.com`, `ytimg.com`, `pstatic.net`, `livecloud-thumb.akamaized.net`(하위 도메인 포함)만 받는다. 사이트는 원본 주소를 그대로 보여 주며 복사하지 않는다. 호스트를 더하면 `features/news/lib/payload.ts`의 `NEWS_MEDIA_HOSTS`와 `next.config.ts`의 `img-src`를 함께 고친다.
- 정해지지 않은 칸은 거부한다(`content.jp` 등).
- 새 `id`는 201, 덮어쓰면 200이다. 응답은 `{ "data": { "id", "created", "day", "url" } }`이고 `url`은 그 날짜의 캘린더 주소다.
- `?dry_run=1`은 검증만 하고 저장하지 않는다. 저장됐을 때의 값을 `item`으로 돌려준다.
- `DELETE /api/v1/news?id=`는 그 파트너가 보낸 소식만 지운다. 응답은 `{ "data": { "id", "deleted" } }`.
- 오류: 400(`issues`에 칸 경로와 이유), 401, 403(`Partner scope news:write required`), 413(본문 64KB 초과), 429, 503.
- 소식 종류별 예시(Steam, X, 프문 소식, 햄햄팡팡, YouTube, 라이브, 점검)는 개발자 도구의 파트너 탭에 있고, 테스트(`tests/features/account/lib/developer-api-reference.test.ts`)가 모두 실제 검증을 통과하는지 확인한다.

## Discord 응답 구성

- 카드 이미지는 사이트가 그린다. 봇은 `card_url`을 Embed의 `image.url`에 넣는다. Discord가 인증 없이 받아 가서 캐시한다.
- Embed 제목은 `url`로 연결하고, 푸터에 출처("최애의 관리자 · saigo-no-dante.com")를 적는다.
- 죄악·공격 유형처럼 작은 아이콘은 봇의 애플리케이션 이모지로, 편성이나 목록처럼 큰 것은 이미지로 보낸다.
- 응답 구성에 3초 넘게 걸릴 수 있으면 먼저 응답을 미룬(defer) 뒤 채운다.

## 코드 위치

| 역할 | 파일 |
|---|---|
| 라우트(한도, 분기) | `app/api/v1/[resource]/route.ts` |
| 키 확인과 권한 | `features/account/server/developer-access.ts` |
| 소식 라우트, 양식 검증, 날짜 계산, 달 단위 조회 | `app/api/v1/news/route.ts`, `features/news/lib/payload.ts`, `features/news/lib/calendar.ts`, `features/news/server/data.ts` |
| 캘린더 화면, 관리자 삭제 | `app/[lang]/calendar/page.tsx`, `features/news/components/NewsCalendar.tsx`, `app/api/admin/news/route.ts` |
| 개발자 도구(문서 데이터, 탭) | `features/account/lib/api-reference.ts`, `features/account/components/` |
| 응답 구성(언어 선택, 주소, 편성·집계) | `features/account/lib/partner-api.ts` |
| 조회(게임 자원은 `'use cache'`, 게임 데이터 태그로 무효화) | `features/account/server/partner-data.ts` |
| 한도, 권한, 파트너 지정 함수, 소식 표 | `supabase/migrations/20261006120000_partners_and_news.sql` |
| 검사 | `tests/features/account/lib/developer-partner-api.test.ts`, `tests/api/developer-v1-partner.test.ts`, `tests/api/developer-v1-news.test.ts`, `tests/features/news/lib/news-payload.test.ts`, `tests/sql/developer-partner.sql`, `tests/sql/partners-and-news.sql`, `e2e/developer-api.acceptance.cjs` |

키 확인과 한도 차감은 DB 함수 `consume_developer_key`가 한다.

자원을 더할 때는 `partner-api.ts`의 `RESOURCES`와 `partner-data.ts`의 `CATALOGS`에 한 줄씩 넣고, 개발자 도구에 보이도록 `api-reference.ts`의 `SOURCES`에도 넣는다. 소식 양식의 칸을 바꾸면 `payload.ts`와 `api-reference.ts`의 `NEWS_BODY`를 함께 고친다(테스트가 두 목록을 비교한다).

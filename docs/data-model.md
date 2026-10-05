# 데이터 모델

앱은 Supabase PostgreSQL의 `limbus` 스키마를 사용한다. 이 문서는 현재 표와 칸, 권한 경계를 설명한다. 문서는 마이그레이션 적용을 보증하지 않으므로 운영 스키마는 연결된 DB와 적용된 마이그레이션에서 확인한다. SQL 변경 근거는 `supabase/migrations`와 기존 `supabase/migration-*.sql`이다. 신규 변경은 날짜가 붙은 마이그레이션으로 추가하고 실제 적용 여부를 따로 확인한다. 칸을 추가하는 순서는 [필드 하나 추가하기](data-sync/adding-a-field.md)에 있다.

## 현재 표

2026-10-01 운영 DB 기준 48개다.

| 영역 | 표 | 주요 코드 |
|---|---|---|
| 수감자·인격·E.G.O | `sinners`, `identities`, `skills`, `passives`, `ego`, `ego_skills`, `ego_passives` | `lib/db/queries.ts`, `lib/types/index.ts` |
| 정신력·설정 | `identity_sanity_conditions`, `mental_condition_templates`, `panic_types`, `app_config` | `lib/db/queries.ts` |
| 키워드와 게임 원문 참조 | `keyword_meta`, `game_text_refs` | `lib/keywords/`, `lib/game-text/` |
| 거울 던전 | `ego_gifts`, `ego_gift_themes`, `ego_gift_recipes`, `md_events`, `md_event_choices` | `lib/planner/` |
| 덱 | `decks`, `deck_identities`, `deck_egos`, `deck_votes`, `deck_comments`, `deck_bookmarks` | `app/api/decks/`, `lib/decks/` |
| 플래너 | `md_plans`(편성과 층별 계획은 JSON), `md_plan_votes`, `md_plan_comments`, `final_gift_presets` | `app/api/planner/`, `lib/planner/` |
| 계정·커뮤니티 | `profiles`, `follows`, `community_activity`, `guest_authorship`, `profile_easter_eggs`, `legal_docs`, `legal_acknowledgements`, `profile_access_signals`, `profile_duplicate_signal_events` | `app/api/community/`, `lib/community/`, `lib/auth.ts` |
| 운영 | `announcements`, `inquiries`, `support_messages`, `site_maintenance`, `audit_logs` | `app/api/admin/` |
| 발견·개발자 API | `discovery_visits`, `developer_keys`, `developer_usage` | `app/api/discovery/`, `lib/discovery/` |
| 어시스트 | `assist_text_embeddings`, `assist_samples`, `assist_reports` | `app/api/assist/`, `lib/vision/` |

- 표 48개 모두 RLS가 켜져 있다(2026-10-01 확인). 공개 읽기 정책이 없는 표는 서버의 service_role만 접근한다.
- 동기화가 쓰는 표는 14개다: `sinners`, `identities`, `skills`, `passives`, `ego`, `ego_skills`, `ego_passives`, `keyword_meta`, `game_text_refs`, `ego_gifts`, `ego_gift_themes`, `ego_gift_recipes`, `md_events`, `md_event_choices`. 반영 전에 백업하고 되돌리기가 복원하는 범위와 같다(`scripts/sync/extraction-restore.ts`의 `RESTORE_TABLES`).
- 제거한 기능의 표는 비공개 스키마 `limbus_retired`에 있다.

### 2026-10-01에 추가된 칸과 함수

- `game_text_refs`: 게임 원문의 `[Id]`가 가리키는 키워드·조건 라벨. 게임 id가 기본키이고 세 언어의 이름·설명·대사(`flavor`)와 `keyword_name`(같은 이름의 `keyword_meta` 행)을 가진다.
- `keyword_meta.game_id`: 그 키워드의 대표 참조(`game_text_refs.id`, 지워지면 null).
- `passives.sin_requirements`: 발동 조건의 죄악 전부(`[{sin, count}]`). `sin_affinity`/`sin_count`는 첫 죄악을 유지한다.
- `ego_passives.flavor`, `flavor_en`, `flavor_jp`: E.G.O 패시브 대사.
- `ego.artwork_url`, `ego.corrosion_artwork_url`: 상세 히어로의 각성·침식 원화 주소.
- `ego_gift_themes.name_color`, `name_segments`, `attribute_type`, `attack_type`, `boss_unit_ids`, `is_unrecordable`: 테마팩 화면 설정(원본 `uiConfigs`).
- 함수 `discovery_user_id(user_email)`: 이메일로 계정 id를 찾는다. service_role만 실행한다.
- 인덱스 `skills(identity_id, skill_order)`, `deck_identities(identity_id)`.

### 남은 정리


## 공통 규칙

- 쿼리는 .schema('limbus')를 지정하고 error를 처리한다.
- Supabase 관리자 클라이언트는 서버 전용이다. 사용자별 쓰기는 세션·권한·입력을 검사한다.
- skills의 동기화 단계 누락은 기존 계약상 3단계로 취급한다. 4단계 데이터가 없으면 3단계를 사용한다.
- skills·passives는 동기화 I~IV를 모두 저장한다(2026-09-25, I·II 스킬 1,217행·패시브 394행 추가, III·IV는 원본과 차이 0). 목록·요약처럼 한 단계만 필요한 곳은 `uptie_level`을 걸러 쓰고, 덱·플래너는 슬롯의 동기화 단계에 맞춰 `rowsAtUptie`/`selectUptieRows`로 고른다.
- `deck_identities.uptie`(1~4, 기본 4)는 슬롯의 동기화 단계다. `gacksung`은 호환용으로 `uptie >= 3`과 같게 저장한다.
- 기프트 효과는 강화 단계별 필드를 사용한다. 표시 등급/tier는 삭제한 커뮤니티 티어표와 다른 개념이다.
- EGO 스킬은 `ego_skills` 관계형 테이블 하나에 저장한다. `EGO.ego_skills`/`ego_cor_skills`는 조회 시 만드는 화면용 배열이며 DB의 중복 JSONB 컬럼은 제거했다. 관계 조회 오류를 빈 스킬로 숨기지 않는다.

## 게임 데이터

`identity_sanity_conditions`는 동기화 IV 기준 조건이다. 원본 템플릿과 매개변수를 분리하고 3개 언어에서 같은 매개변수를 치환한다. 동기화 단계별 조건 이력으로 사용하지 않는다. 현재 복구 건수와 누락 범위는 [출처와 복구 기록](data-sync/provenance.md)를 따른다.

20260910081730_restore_ego_passive_stage_variants.sql은 ego_passives를 추가했다. (ego_id, game_passive_id)가 원본 식별자이고 min_stage/max_stage가 적용 구간이다. RLS는 공개 읽기만 허용한다. 기존 모달/API 호환용 EGO 패시브 컬럼에는 최고 단계 요약을 남겨두었으며, 이 호환용 중복까지 제거한 상태는 아니다.

`assist_text_embeddings`는 원본 게임 테이블을 보존하는 별도 파생 자료다. 모델 ID/revision·전처리 버전·종류·게임 ID·언어·필드·청크를 복합 키로 사용하고 원문/내용 해시와 벡터를 저장한다. RLS를 활성화하고 anon/authenticated 권한을 회수해 서버의 service_role만 접근한다. 따라서 공개 RLS 정책이 없는 것은 의도된 서버 전용 경계다. `match_assist_text_embeddings`는 같은 모델·전처리 버전·언어만 비교하는 security invoker 함수이며 결과는 최대 20개다. 갱신 도구는 해당 모델의 파생 행만 동기화하며 원본 기프트·이벤트·사용자 기록을 변경하지 않는다.

## 게임 기본 설정

`app_config.current_season`은 인격 상세의 파편 교환 시즌 판정에 사용한다. `walpurgis_night`의 `edition`은 최신 확인 회차이고 `active`는 현재 개최 여부다. 회차가 최신이라고 진행 중인 것으로 판단하지 않는다. 발푸르기스 설정은 현재 공개 UI에서 읽지 않는다.

`scripts/sync/seed-game-config.sql`은 기존 설정을 덮어쓰지 않고 빈 키만 초기화한다. 2026-09-12 기준 사용자 `Localize.zip`의 `KR_SeasonTitle`·`KR_GachaTitle`에서 시즌 7·발푸르기스 9회를 확인했다. 개최 기간은 7월 9~23일이므로 비활성으로 설정한다([이벤트 일정](https://limbuscompany.wiki.gg/wiki/Event)). 이 날짜의 복구 기본값이며 이후 시즌·행사 변경 시 별도 갱신해야 한다.

## 인격 메타데이터

`20260910082802_restore_identity_unique_sin.sql`의 `sin_affinity`는 `personality.uniqueAttribute`다. 개별 스킬 죄악이나 키워드 테마로 추측하지 않는다. 185개 전부 원본과 대조해 저장했다. 비어 있던 출시일은 게임 카탈로그의 `updatedDate`로 채웠으며, Drive 파일 수정일이나 추출 배너의 재사용된 시작일을 출시일로 사용하지 않았다. 이후 동기화는 기존 수동 출시일을 덮어쓰지 않는다.

`acquisition_info`는 타입, 시즌, 추출 방식, 파편 가격과 해당하는 경우의 배너 ID·다국어 추출명·발푸르기스 회차·이벤트 보상을 담는 JSON이다. 원본 `season=0`은 상시 추출 구분이며 실제 출시 시즌과 다르다. 예전 백업의 상시 인격 `release_season`은 보존하되 시즌 한정으로 분류하지 않는다. 9101~9199는 발푸르기스 회차를 인코딩한 값이다. 적용 후 동기화 차이가 0개인지 다시 확인했다. 기본 지급 인격의 `fragment_cost=null`처럼 해당하지 않는 JSON 항목은 임의로 채우지 않는다.

32개 컬럼 전체 감사 기록은 복구 폴더의 `identity-column-audit.json`이다. 한국어 획득 대사 185건을 모두 복구했다. 최신 추출본에서 빠진 `11215` LCE E.G.O:: AEDD의 대사는 2026-03-23 원본 백업에서 확인했다. 남은 빈 배열은 원본 `skillKeywordList` 자체가 빈 인격 5건이다. 이 5건은 전체 `keywords`가 있어 화면에서 대체 표시한다. 원본에 없는 대표 키워드나 대사를 만들어 넣지 않았다. `bg_image_url` 185건은 검증된 해당 인격의 원본 일러스트 경로로 연결했다.

기존 저장소의 `backups/2026-03-23/identities.json` 170개 행에서 수동 획득 JSON과 설명을 복구했다. 이벤트/출석 보상, 재화·가격, 교환 시점은 현재 추출본에 과거 상점이 없다고 삭제하지 않는다. 원본 희귀도로 확인된 `10805` 파편 가격(150)과 `11103` 게임 시즌(1)은 오래된 백업 값을 수정했다. 백업의 입력 해시·적용 계획은 `historical-metadata-plan.json`, 복구 직전 값은 `before-historical-metadata.json`에 남겼다.

## 키워드 카탈로그와 사용 관계

`keyword_meta`는 키워드 이름(기본키)마다 원문·번역·아이콘 슬러그·분류를 가진다(초기 복구 때 482개). 2026-10-01부터 `game_id`가 참조 표 `game_text_refs`의 대표 행을 가리키고, 사이트는 그 행의 언어별 이름·설명을 먼저 쓴다(두 표의 역할은 [동기화 규칙](data-sync/rules.md) "게임 원문 저장과 참조 표"). 인격/EGO의 `keywords`는 사용 관계이고, 기프트의 `keyword`는 대표 분류이므로 기프트 효과의 모든 키워드를 담는 필드가 아니다. 메타 재생성은 인격·EGO 스킬/패시브의 실제 태그와 기프트 강화 효과를 함께 읽는다. 패시브 제목과 키워드 이름이 같다는 이유만으로 연결하지 않는다.

누락 메타 135개와 EGO 108개의 사용 배열을 복구했다. 기존 행과 원본에 키워드가 없는 EGO 4개는 유지했다. 이전 도감 백업은 현재 원문에서 이름이 확인되는 항목만 추가 근거로 사용했다. 동일 원본 이름에 2번 아이콘이 있으면 공통 URL 해석기가 2번을 우선하되, 사용자 확인을 받은 신력 단말기 무기 키워드 9종은 원본을 사용한다. `category`와 `effect_type`은 서로 다른 필드다. 현재 `기타` 분류를 지원하며 내용으로 임의 분류하지 않는다. 백업·재실행 명령·남은 미확정 그림은 [출처와 복구 기록](data-sync/provenance.md)에 기록했다.

## 공개 편성 분석

분석은 공개 권한으로 보이는 덱과 거던 플래너를 동일 비중으로 집계하며 기본 기간은 전체다. 최근 30/90일은 사용자가 선택한다. 해당 기간이 비면 전체 기간으로 이동할 수 있다. 2026-07-03 플래너 1건은 기간 제한과 도감 복구 전 UUID 때문에 누락됐었다.

플래너 JSON의 인격 UUID가 현재 도감에 없으면 `game_id`와 `sinner_id`가 일치하는 유일한 인격만 조회 시 연결한다. EGO는 저장된 수감자·등급·한국어 이름이 모두 일치하는 유일한 항목만 연결한다. 같은 이름이 둘 이상이거나 연결 근거가 부족하면 추측하지 않는다. 키워드·이미지·인격 정보는 현재 도감을 사용하며 저장된 플랜 JSON은 덮어쓰지 않는다. 현재 공개 편성 1건에서 배틀 7개·서포트 5개·EGO 7개가 집계된다.

## 거던 이벤트 연결

`md_events.category`의 `entry`는 테마팩에 직접 등록된 진입점, `continuation`은 원본 연결로 도달하는 하위 노드다. 하나의 노드를 여러 부모가 공유하거나 자기 자신으로 돌아갈 수 있으므로 `variant_of`로 부모 관계를 표현하지 않는다. `variant_of`는 원본 필드와 세 언어 문구가 ID 말고 모두 같은 사본이 대표 이벤트를 가리킬 때만 채운다(현재 971071·971072 → 971070). 목록은 명시적 category를 따르고 사본은 갤러리와 어시스트 인식에서 뺀다.

`md_event_choices`의 `option_index`와 `result_index`가 원본 선택지와 결과를 구분한다. `outcome`은 성공/실패, `result_condition`은 확률·정신력·실패 횟수 조건, `selection_condition`은 선택에 필요한 기프트/코스트다. `effects`는 원본 resultForm과 세 언어의 효과 텍스트, 확인된 실제 gift_id를 보존한다. `md_events.judgment`는 판정 수치·죄악·인원·보정 조건을 담는다. 원본 연결은 `next_event_id` FK다.

## 커뮤니티 활동과 공개 프로필

`20260911004147_community_activity_and_profiles.sql`을 적용했다. `profiles.public_profile`은 기본 공개이며 비공개 프로필은 공개 API에서 404로 처리한다. 공개 응답은 닉네임·아바타·소개·가입일·활동 집계와 최근 덱만 포함한다. 이메일과 수집 코드는 공개하지 않는다. 닉네임 또는 공개 범위 변경 시 작성한 덱과 목록 캐시도 만료한다.

`community_activity`는 서버 전용 포인트 원장이다. 덱 게시 20점(한국 시간 하루 3건), 타인 덱 좋아요 2점(하루 5건), 관리자 승인 데이터 기여 50점이다. DB 기여는 데이터 문의에 관리자가 답변하고 승인해야 반영된다. 좋아요 취소·덱 삭제·승인 철회 시 해당 점수를 비활성화한다. 취소 후 재등록은 기존 점수를 복원하며 일일 한도를 새로 만들지 않는다. 본인 덱 좋아요는 점수를 주지 않는다. 횟수는 점수 한도를 넘은 활동도 포함한다. 도전과제·뱃지는 사용자 결정에 따라 만들지 않았다.

활동 기록 쓰기와 집계 RPC는 service_role 전용이다. 프로필의 공개 컬럼만 직접 조회할 수 있으며 관리자 권한·이메일 등은 제외한다. 기존 DB의 다른 테이블에 남은 RLS 경고를 해결한 것은 아니다. 기존 계정 삭제 API의 `delete_user_account` RPC는 연결 DB에 없어 별도 복구가 필요하다.

## 월간 광기 계획

광기 계획은 계정 DB 대신 브라우저 쿠키 `limbus_lunacy_v1`에 시작 월별로 저장한다. 압축한 값은 3,800자 이내로 제한하고 1년, SameSite=Lax, HTTPS에서는 Secure를 적용한다. 저장 실패 시 기존 쿠키를 보존하고 오류를 표시한다. 이전 localStorage 계획은 해당 기간을 열 때 검증 후 쿠키로 이전하며 원래 기록은 보존한다. 시작 월과 다음 월의 날짜별 구매·거던·기타 보상, 월초 무료/유료 잔액, 월정액 잔여 일수를 보관한다. 이전 계획의 초회 사용 여부와 다른 상품 구매는 호환성을 위해 복원한다. 서로 다른 기간은 독립된 시나리오다. `planSchema`로 복원 데이터를 검증한다.

무료 광기, 유료 광기, KRW 결제 금액을 따로 집계한다. 추출 티켓은 입력·집계·광기 환산에서 제외한다. 구매 선택은 월간 광기(21, 9,900원)와 월간 광기 소형(22, 4,400원) 및 일반 광기 충전 6종이다. 잔액은 획득 계획이며 추출·엔케팔린 충전 소비는 차감하지 않는다. 패키지 구매 금액은 구매일에만, 월정액 일일 무상 보상은 수령일에만 기록한다. 월초 이전 월정액은 남은 일수, 첫 부분 주의 거던은 이미 쓴 보너스 횟수로 입력한다. 거던 주간 한도는 목요일 기준 두 달에 걸쳐 공유한다. 일반 광기 상품은 구매 일정별 초회 ON/OFF와 수량을 저장한다. 사용자는 앞선 구매와 관계없이 초회를 선택할 수 있다. 1~100회 중 초회 ON이면 1회분만 초회 보상이고 나머지는 일반 보상이다.

## 개발자 API와 관심도

`developer_keys`는 원문 대신 SHA-256 해시, 소유자, 표시용 앞부분, 폐기·최근 사용 시각을 보관한다. `developer_usage`는 키별 UTC 날짜와 요청 수를 저장한다. 키 원문은 발급 응답에서 한 번만 제공한다. 로그인·정지 여부·소유권을 확인하는 서버 API로만 키를 관리하며, 공개 조회 API는 Bearer 키와 분당 60회·하루 10,000회 제한을 적용한다. `profiles.partner`(`discord_bot` 또는 null)가 있는 계정의 키는 하루 제한 없이 분당 600회까지 쓰고 파트너 전용 자원을 읽는다. 이 칸은 관리자 전용 함수 `admin_set_partner`로만 바꾸며 변경마다 `audit_logs`에 `set_partner`를 남긴다. 자원과 응답 형식은 [개발자 API와 협업 파트너](partner-api.md)에 있다. 요청 소비 함수의 행 잠금으로 동시 요청도 합산한다. 데이터 응답은 공개 읽기 RLS와 명시적 필드 목록을 사용한다.

`discovery_visits`는 HMAC 처리한 브라우저 식별자, 대상 종류/ID, UTC 날짜만 보관한다. 원문 검색어나 IP는 이 테이블에 저장하지 않는다. 기간별 고유 브라우저 수이며 실제 사람 수·전투 사용률이 아니다. 공개 API는 집계만 반환하고 원시 방문 기록·개발자 키 테이블은 service_role만 접근한다. 최근 열람·검색어는 브라우저 localStorage에 각각 최대 20개를 저장한다. 게시판 화면에는 기록 관리 버튼을 표시하지 않는다.

층별 계획 JSON의 `constraints`는 11~15층 제약 ID 배열이다. 앞 층의 선택을 바꾸면 뒤 층의 교체 규칙을 다시 적용한다. 플랜 코드 v3는 제약·층별 기프트·메모도 함께 저장하며 이전 코드를 읽을 수 있다.

덱과 플래너 상세 설명은 기존 Markdown 문자열을 유지한다. 편집기는 제목·목록·인용·빈 단락 양식과 이미지 첨부를 제공한다. 이미지 주소는 자체 Storage의 `notes/UUID.webp`만 렌더링하며 로그인 사용자만 업로드할 수 있다. PNG/JPEG/WebP 8MB 이하·4천만 픽셀 이하를 검사하고 EXIF 제거 후 최대 1920px WebP로 저장한다.

## 팔로우와 목록 공개 범위

`follows`는 팔로워·대상 프로필의 조합을 기본 키로 사용한다. 본인 팔로우와 중복 관계는 DB에서 차단한다. 정지 계정은 관계를 추가할 수 없고, 비공개 프로필에는 새 팔로우를 만들 수 없다. 기존 팔로우 취소는 대상이 비공개로 바뀐 뒤에도 가능하다. 관계와 조회 RPC는 service_role만 접근한다.

`profiles.public_following`과 `public_followers`는 각각 기본 비공개다. 소유자만 비공개 목록과 인원수를 볼 수 있고, 다른 사람에게는 빈 목록과 null 인원수를 반환한다. 프로필 자체가 비공개이면 목록 공개 설정과 관계없이 외부 조회를 차단한다. 공개 목록은 페이지당 25명이며 공개 프로필만 표시한다. 응답에 이메일을 포함하지 않는다. `/api/community/profiles/[id]/follows`의 조회·생성·취소와 공개 범위 저장은 세션에서 사용자를 결정하며 응답을 캐시하지 않는다.

### 댓글 알림

`20261002124850_comment_notifications.sql`을 적용했다. 알림은 따로 저장하지 않는다. `limbus.user_notifications(이메일, 최대 행)`이 조회할 때 댓글 표(`deck_comments`, `md_plan_comments`)에서 내 덱·플랜에 다른 사람이 단 댓글과 내 댓글에 달린 답글을 최신순으로 뽑는다(기본 30개, 최대 50개). 댓글이 지워지면 알림도 같이 사라진다. 읽음은 `profiles.notifications_read_at` 한 칸이다. `limbus.mark_notifications_read(이메일)`이 그 칸을 지금으로 바꾸고, 그 뒤에 달린 것만 읽지 않음이다. 두 함수는 service_role만 실행하며 `/api/notifications`(GET 목록, POST 읽음)가 세션 이메일로만 부른다. 조회는 댓글 표 전체를 훑으므로 댓글이 크게 늘면 글·답글 갈래별 조회로 나눈다. 검사는 `tests/sql/community-notifications.sql`.

관리자에게는 답변을 기다리는 문의도 같은 목록에 보인다. `20261003134642_admin_inquiry_notifications.sql`(적용함)의 `limbus.admin_inquiry_notifications(이메일, 최대 행)`이 다른 사람이 보낸 `open` 문의를 한 건에 한 줄씩, 마지막 유저 메시지를 기준으로 최신순으로 돌려준다(줄 모양과 읽음 칸은 댓글 알림과 같다). 저장하는 것은 없고, 관리자가 답해 상태가 바뀌면 줄이 사라진다. 누가 관리자인지는 `/api/notifications`가 세션으로 정하며, 이 함수 조회가 실패하면 댓글 알림만 돌려준다. 검사는 `tests/sql/admin-inquiry-notifications.sql`.

### 유저 관리와 최근 편집 집계

`admin_list_users`와 `admin_moderate_user`는 service_role만 호출할 수 있다. 이메일 검색은 `auth.users` 직접 접근 권한을 넓히지 않고 고정된 검색 경로의 함수 안에서만 수행한다. 이용 제한과 감사 기록은 같은 트랜잭션에 저장한다. 본인·운영 계정 보호, 정지된 운영자 거부, 만료된 제한 판정, 이전 `suspended_at`을 이용한 동시 변경 검사를 적용한다. `audit_logs`는 비공개이며 공개·일반 로그인 클라이언트의 직접 접근을 허용하지 않는다.

발견 목록의 ‘최근 수정’은 `updated_at` 대신 `deck_update`·`planner_update` 감사 기록으로 정한다. 최초 업로드와 조회·추천 집계는 편집으로 취급하지 않으며, 기존 게시물 중 편집 기록이 확인된 것만 표시한다. `discovery_recent_edits`는 서비스 전용이며 공개 API에는 게시물만 전달한다.

## 공지와 문의

공지·문의 개편: `announcements`에 `lang`, `published`, `content_doc`을 추가했다. 기존 공지의 게시 상태는 보존하며 새 공지는 API에서 기본 초안으로 저장한다. 공개 조회는 요청 언어와 `published=true`를 모두 제한하고 변경 시 공지 캐시 태그를 만료시킨다.

`inquiries`에는 작성자 프로필 ID, 분류, 제목·본문, 접수/답변 완료/종료 상태, 관리자 답변·답변자·시간을 저장한다. 두 테이블은 RLS를 활성화하고 anon/authenticated 직접 접근을 차단한다. NextAuth 세션을 검증하는 서버 API만 service_role로 접근한다. 기존 사용자·덱·게임 데이터는 삭제하지 않는다. 프로필 트리거가 없는 복구 DB에서도 신규 계정의 프로필을 보완하며 기존 프로필은 덮어쓰지 않는다.

공지 이미지 경로는 `limbus-assets/announcements/{uuid}.webp`다. 입력 PNG/JPEG/WebP 최대 8MB, 디코딩 4천만 픽셀, 출력 최대 1920px를 적용한다. 다른 공지에서 재사용할 수 있으므로 공지 삭제 시 이미지 파일을 즉시 삭제하지 않는다.

## 스키마 변경 기록과 되돌리기

2026-09-10 `20260910064305_retire_unused_features.sql`을 연결 프로젝트에 적용했다. 삭제 기능의 테이블 11개, 감성 추이 뷰, AI 요약 함수를 `limbus_retired`로 이동했다. 이 스키마는 anon/authenticated에 공개하지 않는다. 이동 전 11개 테이블과 중복 EGO 컬럼의 데이터가 모두 0건임을 확인했다. 값이 있는 다른 환경에서는 중복 컬럼 제거를 중단한다.

되돌릴 때는 `supabase/rollback/retire_unused_features.sql`로 원래 스키마를 복원한다. 과거 마이그레이션, 사용자/덱/플래너 기록, Discord 봇 테이블, 기존 backup 테이블은 보존했다. 전체 DB 권한 정비를 완료한 것은 아니다. 당시 Supabase 검사에는 기존 `skills`, `deck_identities`, 일부 게임/백업 테이블의 RLS 미설정과 함수 search_path 경고가 남아 있었다. RLS는 이후 모든 표에 켜졌고(위 "현재 표") search_path는 5단계에 남아 있다.

2026-09-29 `20260929095502_drop_discord_bot_tables.sql`로 서비스를 종료한 Discord 봇 테이블 5개(`feed_tracker`, `guild_settings`, `guild_feed_history`, `tickets`, `warnings`)를 삭제했다. 사이트 코드는 이 테이블을 쓰지 않았고, 참조하는 외래 키·뷰·트리거·함수·cron도 없었다. 삭제 직전 행은 `backups/2026-09-29/`에 있고, 스키마는 `supabase/rollback/drop_discord_bot_tables.sql`로 되살린다. 관리자 공지를 Discord로 보내는 웹훅은 봇과 별개라 유지한다.

2026-09-10 `20260910071945_restore_ego_skill_source_fields.sql`을 적용했다. `ego_skills.game_skill_id`는 이름이 해석 단계에 따라 바뀌어도 같은 원본 스킬을 연결하며, `mental_consume`은 원본 정신력 소모다. 해석 I~V는 원본이 지원하는 최대 단계까지만 저장한다. 카드의 `max_construe_level`은 스킬 관계에서 계산하는 조회 값이며 중복 DB 컬럼을 추가하지 않는다.

`20260910140000_rebuild_mirror_event_graph.sql`과 `20260910141000_scope_mirror_event_replacement.sql`을 적용했다. 두 번째는 서비스 역할에서 실행되는 safe-update 검사에 맞춰 교체 범위를 양의 게임 데이터 ID로 지정한다. 교체 전 두 테이블 백업과 원자적 롤백 시험을 수행했고, 적용된 330개 노드·736개 결과를 계획과 모든 필드 단위로 대조했다. 복원은 `before-event-graph-rebuild/` 백업으로 두 테이블을 같은 트랜잭션 안에서 복원해야 하며 코드 revert만으로 DB가 되돌아가지는 않는다.

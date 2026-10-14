# 구조

관리자 화면은 공지(`/admin/announcements`), 문의(`/admin/inquiries`), 유저 관리(`/admin/users`)를 제공한다. 유저 관리는 닉네임·이메일 검색, 상태 필터, 작성 활동 확인과 사유를 남기는 이용 제한·해제를 지원한다. 역할 변경과 계정 삭제는 제공하지 않는다. 점검 관리(`/admin/maintenance`)는 경로별 점검을 즉시 또는 시작·종료 시각을 정해 예약한다. 이전 덱·게임 데이터·키워드·법률·감사 로그 관리 화면과 전용 API는 제거하고 DB 기록은 보존한다. 커뮤니티 메뉴의 `/support`에서 로그인 사용자가 비공개 문의를 작성하며, 서버가 작성자 ID를 지정하고 조회 범위를 제한한다.

공지는 Tiptap 문서 JSON과 평문을 함께 저장한다. 관리자 미리보기, 공개 공지 목록, 메인 공지는 동일한 안전한 본문 렌더러를 사용한다. 임의 HTML을 실행하지 않으며, 이미지 업로드는 관리자 전용 서버에서 WebP로 변환한다.

Next.js 16 App Router + React 19 + TypeScript. 공개 페이지는 app/[lang]에 있고 ko/en/ja를 지원한다.

| 영역 | 역할 |
|---|---|
| app/[lang] | 서버 조회, 메타데이터, 페이지 조합 |
| components | 기능별 UI, 재사용 가능한 ui/ primitive |
| hooks, lib/hooks, lib/stores | 브라우저 상태와 생명주기 |
| lib/identity, lib/decks, lib/planner, lib/random | 독립 검증 가능한 도메인 로직 |
| app/api, lib/schemas | 요청·인증·입력 검증 |
| lib/db, lib/supabase | DB 조회와 권한별 클라이언트 |
| lib/i18n, messages | 번역과 데이터 이름의 지역화 |
| supabase | 스키마 이력. 동기화 코드는 추출 도구 저장소(`limbus-asset-extractor/site-sync`)에 있다 |

인격 상세의 경계:
- IdentityDetailClient: 페이지 탭, 초상화, 각 영역 조합.
- useIdentitySkillModel: 동기화 단계와 비교 상태, 메모이제이션.
- lib/identity/skill-model: 단계별 행 선택, 스킬 정렬과 변형 번호.
- lib/spine/pack: Storage의 Spine 묶음(`limbus-assets/spine/`, 추출 도구가 올림) 형식과, 한 인격의 폼·스킨 묶음·동작·탭 이름 계산. 페이지 서버 코드가 묶음을 읽어 그 인격 몫만 잘라 넘긴다.
- components/spine/SpineStage: Spine 4.0 런타임으로 SD와 풀 일러스트를 그린다. 파일은 Storage 주소에서 바로 읽는다. 런타임은 4.0에 고정한다(4.1 이상은 이 뼈대를 읽지 못함).
- lib/spine/save: 그려진 장면을 PNG·GIF·동영상으로 저장한다.
- IdentityCombatSection: 스킬/패시브 탭과 동기화 조작.
- useIdentityGuideData: 기존 운영법 토큰의 한/영/일 별칭과 자동완성.
- IdentityGuideSection: 사람이 작성한 운영법. AI 생성 경로는 없다.

재사용은 실제 중복·변경 이유를 기준으로 한다. 거대한 파일은 도메인 계산, 데이터 경계, 상태, 화면으로 나누되 단순 전달 wrapper는 만들지 않는다.

공통 컴포넌트와 계산:
- `components/passive/PassivePanel`, `PassiveEffect`: 덱·플래너·노트가 같은 패시브 UI를 사용하고 panel/note 변형만 구분한다. 조건 계산과 인격별 색인은 `lib/planner/passives`가 담당한다.
- `components/ui/GiftCard`: 기존 hover 확대·그림자·0.2초 전환을 CSS로 유지하며 hover만으로 React 상태를 갱신하지 않는다.
- `lib/keywords/catalog`: 카탈로그 객체별 WeakMap에 지역화·별칭·죄악 색인을 공유한다. 원본 객체가 교체되면 새 색인을 만든다.
- `components/collection/useCollectionModel`: 보유 수 집계와 검색 필터를 분리한다.

메타분석은 `lib/meta/aggregate`의 순수 집계를 서버 페이지와 `/api/meta/usage`가 공유한다. 공개 덱과 `md_plans`의 편성을 30일/90일/전체 기간 및 출처별로 읽는다. 게시물당 같은 비중이며 알려진 전투 인격이 없는 편성은 분모에서 제외한다. 같은 수감자의 중복 인격·같은 EGO·키워드는 편성당 한 번 계산하고, 동시 편성은 전투 슬롯끼리 계산한다. 채용 빈도를 성능/승률로 해석하지 않는다.

분석 화면의 필터(콘텐츠·키워드 덱·난이도·수감자·등급, 필터마다 여러 값)는 `/api/meta/usage`의 쿼리로 전달되고 `parseMetaFilters`가 허용 목록으로 검증한다. 필터가 없는 범위(출처 × 기간)만 결과를 캐시하고, 필터가 걸린 요청은 캐시된 편성과 카탈로그에서 다시 집계한다(DB 조회 없음, 요청 제한 적용).

메타 조회는 공개 클라이언트를 사용하고 페이지 제한을 끝까지 읽는다. 오류 시 부분 통계를 반환하지 않는다. `decksList`/`plansList` 태그로 수정·삭제 시 통계를 함께 무효화한다. 클라이언트 SWR은 출처/기간 변경과 오류·재시도를 처리한다. 막대/숫자 애니메이션을 유지하면서 관찰자 2개와 RAF 루프 1개를 공유한다.

이미지 경로는 lib/utils/images.ts, 스킬 이미지 번호는 computeSkillImageIndices를 재사용한다. DB skill_order를 이미지 파일 번호로 직접 쓰지 않는다.

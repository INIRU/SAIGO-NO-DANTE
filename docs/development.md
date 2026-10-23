# 개발과 검증

경험치 계산기는 `/[lang]/tools/experience`에서 사용한다. 네비게이션의 도구 메뉴는 기타 앞에 배치한다. 레벨·경던 선택은 공통 `Dropdown`을 사용하며 방향키·Home/End·Enter·Esc를 지원한다. 공개 화면에는 출처 블록을 표시하지 않고 자료 근거는 `data-sync/provenance.md`에 남긴다. 기본 상태는 레벨 1→60, 보유 티켓 0, 경던 9단계다. 입력은 브라우저 세션 간 저장하지 않는다.

검증: 빌드·타입 검사, 단위 158개 통과(기존 HTTP 통합 11개 제외). 실제 Chrome에서 계산기 ko/en/ja × 1440px/390px의 하드 리프레시·재방문과 수량 변경, PC/모바일 도구 메뉴, 커스텀 메뉴 키보드 조작, 인격 획득 정보의 원본 파편을 검사했다. Chrome 10개 중 9개 통과 후, Next 스트리밍의 숨겨진 HTML을 검사하던 모바일 테스트를 가시 요소로 한정하고 해당 1개도 통과했다. 화면 기록은 `chrome-experience-tools/`와 `chrome-experience-tools-recheck/`에 보존했다. 공개 파편에는 사용자 결정에 따라 유리 오버레이가 없다.

피해량 계산기는 `/[lang]/tools/damage`에서 사용한다. 계산은 `lib/tools/damage.ts`의 `coinDamage`가 하고 화면(`components/tools/DamageCalculator.tsx`)은 입력만 모은다. 보정 칸(`components/tools/DamageModifiers.tsx`)은 내 인격·기프트·대상·직접 입력으로 나뉘고, 키워드·기프트 후보는 +나 타일을 처음 누를 때 `/api/damage-sources/[lang]`에서 불러온다. 이 경로는 `ego_gifts`와 `keyword_meta`의 설명 문구를 `lib/tools/damage-sources.ts`로 해석하며 `egoGifts`·`keywords`·`gameData` 태그를 따른다(DB 칸이나 동기화 코드는 추가하지 않았다). +는 후보를 고르는 창을 연다: 기프트는 플래너의 `FloorGiftPickerModal`을 그대로 쓰고 키워드는 같은 틀의 창이며, 누르면 적용되고 다시 누르면 빠진다. 스택 키워드인지는 후보 목록이 설명 문구에서 읽어 알려 준다(이름 목록 없음). 직접 입력은 적용 코인(모든 코인 또는 n번째)을 고를 수 있고, 코인별 계산에는 `coinModifiers`가 그 코인의 보정만 넘긴다. ✕는 닫기만 하며 삭제는 "삭제" 버튼이 한다. 숫자 칸(`components/tools/NumberInput.tsx`)은 입력 중인 글자를 그대로 두어 `-`나 `.`이 지워지지 않는다. 보정 항목만 localStorage `damage-calculator-modifiers`에 남고 나머지 입력은 저장하지 않는다. 모바일에서는 결과가 내비게이션 아래에 붙는 한 줄 막대로 바뀐다(`--nav-offset`). 공식과 수치의 근거는 `data-sync/provenance.md`의 "피해량 계산기 자료"에 있다. 개발 서버에서 이 API의 응답 형태를 바꾸면 `use cache` 응답이 남아 있으므로 서버를 다시 띄운다.

인격 스킬 모션은 `/[lang]/motion/skills`에서 본다. 영상(`layers.mp4`)·메타(`layers.json`)·색인(`index.json`)은 추출 도구가 R2 `limbus-assets`(`https://assets.saigo-no-dante.com/`)에 올리고, 브라우저가 페이지를 열 때마다 색인을 R2에서 직접 받고(`cache: 'no-cache'`), 인격·스킬 이름은 `/api/motion/site-data`(DB, 1시간 캐시)에서 받아 `motionCatalogFrom`으로 목록을 만든다. 사이트맵과 스킬 메타데이터만 서버가 색인을 10분마다 읽는다(`lib/motion/feed.ts`, 캐시 태그 `motion`). 영상과 메타도 R2 원래 주소(`?v=` 없이)에서 직접 받아 `lib/motion/compositor.ts`(추출 도구가 준 파일 그대로)로 WebGL2 캔버스에 그린다. `assets.saigo-no-dante.com`은 모든 응답에 `Access-Control-Allow-Origin: *`(Cloudflare 규칙)이라 어느 주소에서든 WebGL이 프레임을 읽는다. 스킬 카드는 `skills.image_id` = R2 스킬 id로 찾는다(`/api/motion/skill`).

이벤트 판정의 성공·실패 결과는 모든 화면 폭에서 한 열로 쌓는다. Chrome 회귀 검사는 세 언어에서 두 결과의 세로 순서·동일한 폭과 하드 리프레시·재방문을 확인한다. 해당 3개 검사와 빌드·타입 검사를 통과했다.

공지·문의 개편 검증: 빌드와 타입 검사, 단위 153개 통과(기존 HTTP 통합 11개 제외). 실제 Chrome에서 임시 검증 계정으로 문의 소유자 분리, 비로그인·일반 사용자 관리자 접근 거부, 문의 답변, WebP 업로드, 초안 저장과 공개 목록 제외를 확인했다. 프로필 없는 신규 계정도 문의 작성에 성공했다. 1440px/390px에서 하드 리프레시와 다른 페이지를 경유한 재방문, 가로 넘침을 확인했다. 화면 기록은 `../assets/recovery-2026-09-10/chrome-support-admin/`에 있다. 검증용 계정·문의·공지 초안·이미지는 모두 정리했다. 실제 공개 공지 게시나 운영 도메인 배포는 하지 않았다.

CI의 Node.js 22 환경을 기준으로 한다. 정확한 의존성 버전은 package-lock.json이 기준이다.

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

개발 서버의 기본 주소는 http://localhost:3000이다. 환경 변수는 [배포 문서](deployment.md)를 따른다.
Vitest는 순수 계산과 회귀 검증, Playwright는 실제 페이지 흐름에 사용한다. 운영 DB 쓰기가 발생하는 브라우저 검증은 테스트 계정/승인된 범위에서만 수행한다.

## 캐시

Cache Components는 next.config.ts에서 켜져 있다. cacheLife의 page-1m/5m/10m/1h/1d 프로필과 각 페이지의 cacheTag를 확인한다. 업데이트 후 lib/constants/cache-tags.ts와 app/api/revalidate/route.ts의 무효화 계약을 사용한다.

브라우저의 서비스 워커는 별도 계층이다. components/pwa/ServiceWorkerRegister.tsx가 개발/localhost에서 서비스 워커와 saigo- 캐시를 정리한다. public/sw.js는 배포 환경의 오프라인/정적 리소스 정책이다.
서비스 워커는 변경 가능한 이미지를 캐시에서 바로 보이고, 저장한 지 6시간이 지난 이미지만 백그라운드에서 서버에 재검증(`cache: 'no-cache'`, 보통 304)해 다음 방문부터 갱신된 이미지를 쓴다. 예전처럼 조회마다 다시 받고 캐시에 다시 쓰지 않는다. 캐시에 없는 이미지는 네트워크 응답을 바로 돌려주고 저장은 백그라운드에서 한다. 이미지 캐시는 1500장, 정리는 쓰기 40회마다 한다. CORS 없이 `<img>`로 받는 스토리지 이미지(불투명 응답)는 캐시할 수 없어 워커를 거치지 않는다. 해시가 붙은 Next 정적 파일은 cache-first, API는 캐시 대상에서 제외한다. 공개 아이콘과 이미지 출력은 WebP로 통일했다.

## 정적 셸과 요청 시 렌더링

빌드 후 `.next/server/app/<경로>.meta`에 `postponed`가 있으면 그 페이지는 조회마다 함수를 부른다(`4:null…`은 RSC만, `숫자:[…]`는 HTML 구멍까지). Vercel은 이때 postponed state(프리렌더가 읽은 `'use cache'` 값 포함)를 함수에 POST하고 함수가 나머지를 스트리밍한다. 둘 다 Fast Origin Transfer로 과금된다. `postponed`가 없으면 CDN이 HTML과 RSC를 바로 준다.

- 루트 `app/not-found.tsx`는 모든 페이지의 RSC에 들어간다. 서버 컴포넌트에서 next-intl의 `NextIntlClientProvider`를 쓰면 빠진 now/timeZone/formats를 요청 설정에서 채우며 `headers()`를 읽어 전 페이지가 요청 시 렌더링된다. 클라이언트 모듈인 `components/providers/IntlClientProvider`를 쓴다.
- 페이지는 레이아웃과 병렬로 렌더링된다. 페이지에서 locale 없이 부른 `getLocale()`·`getTranslations('ns')`는 레이아웃의 `setRequestLocale`보다 먼저 실행되면 `headers()`를 읽으므로 `params`의 lang을 넘긴다. 두 규칙은 `tests/app/intl-static-rendering.test.tsx`가 검사한다.
- 정적 라우트에서 `useSearchParams`를 읽는 영역은 브라우저 렌더링으로 넘어간다(HTML의 `$RX("B:…","BAILOUT_TO_CLIENT_SIDE_RENDERING")`). nuqs로 필터를 URL에 두는 거울 던전, 플래너, 플래너·덱 게시판, 키워드, 인격·EGO 목록은 클라이언트 컴포넌트를 `components/providers/StaticQueryAdapter`로 감싼다. 서버는 쿼리 없는 기본 화면을 정적 HTML로 만들고, 쿼리가 붙은 주소는 첫 페인트 전 인라인 스크립트가 `html[data-query-pending]`을 붙여 기본 화면 대신 페이지 스켈레톤(`fallback`)을 보이고(globals.css), 하이드레이션 직후 그 영역을 한 번 다시 마운트해 URL 값으로 시작하며 같은 프레임에 스켈레톤을 치운다. 쿼리 없는 방문과 이후 필터 변경은 다시 마운트하지 않는다. 덱·플래너 게시판은 목록을 프리렌더하지 않는다. 기본 화면은 추천 선반이고, 전체 보기·필터를 켤 때 클라이언트가 목록을 불러온다.
- 이 어댑터 아래 컴포넌트는 마운트 직후 URL에 쓰면 안 된다(다시 마운트되기 전 인스턴스의 쓰기가 URL을 덮어쓴다). 지금은 검색어 debounce(타이머, 다시 마운트 때 정리됨)뿐이다. 마운트 직후 `?sinner`를 쓰는 컬렉션 편집기와 쿼리로 안내문을 그리는 점검 페이지는 `components/layout/RequestTimeRoute`로 요청 시 서버 렌더링을 유지한다. 마이페이지는 세션을 브라우저에서 읽으므로 정적 HTML에 같은 스켈레톤을 둔다.
- 정적 페이지가 다시 생성되면 HTML·RSC·세그먼트 전체가 ISR에 다시 쓰인다(ISR Writes, 8KB 단위, 바이트당 Fast Origin Transfer보다 비싸다). 그래서 투표·댓글·새 글마다 무효화되는 데이터(`decksList`/`plansList` 태그)나 `cacheLife('minutes')` 데이터는 정적 페이지에 넣지 않는다. 홈 커뮤니티 선반은 `components/home/HomeCommunity`가 `/api/discovery`(CDN 60초)에서 불러오고, 메타 페이지는 요청 시 렌더링한다. `tests/app/static-pages-activity-tags.test.ts`가 홈·게시판을 검사한다. 빌드 후 `.next/prerender-manifest.json`의 `initialRevalidateSeconds`와 `.meta`의 `x-next-cache-tags`로 재생성 주기와 태그를 확인한다.
- 동기화 스크립트(`limbus-asset-extractor/site-sync/scripts/sync/*`)는 실행할 때마다 게임 데이터 태그 전체를 무효화해 방문되는 모든 페이지를 다시 쓴다. 패치 때는 스크립트를 이어서 돌린 뒤 한 번만 반영되도록 묶는 편이 ISR 쓰기가 적다.
- 요청 시 페이지의 postponed state에는 프리렌더가 읽은 캐시 값이 모두 실린다. 레이아웃은 설명을 뺀 `getKeywordCatalog()`를 따로 캐시한다(기본 크기 약 61KB→19KB).

## 이미지·렌더링 성능

- **폰트:** Pretendard는 `scripts/assets/subset-pretendard.py`가 unicode-range로 나눈다. 라틴·기호·KS X 1001 2,350자(572KB)만 모든 페이지에서 선행 로드하고, 나머지 음절·가나 등(1.5MB)은 그 글자가 보일 때만 받는다. en/ja 굵은 제목은 라틴 부분집합(178KB)이다. `app/pretendard.ts`는 생성 파일이며 원본 `public/fonts/PretendardVariable.woff2`에서 다시 만든다.
- **이미지:** next/image 출력은 WebP만 만든다(원본이 WebP이고 AVIF 인코딩이 캐시 미스마다 느렸다). `/assets`·`/icons`·`/images`·`/placeholders`는 1일 캐시 + 30일 백그라운드 재검증이다. 수정한 스프라이트는 `?v=`나 해시 파일명으로 바꾼다. 블러 자리표시자는 ThumbHash를 8px PNG(평균 0.44KB, 이전 4.6KB)로 그린다. 홈 히어로는 서버에서 렌더링해 첫 원화의 preload가 HTML에 들어가고, 인격·EGO 목록 첫 줄 6장은 원화를 먼저 받는다. EGO 목록은 36장씩 스크롤에 따라 렌더링한다.
- **데이터:** 루트 레이아웃의 키워드 카탈로그에는 설명이 없다. 툴팁을 처음 열거나 키워드에 마우스를 올릴 때 `/api/keyword-descriptions/[lang]`에서 받는다. 인격 상세 페이지와 인격·EGO 모달 API, 컬렉션·공지 목록은 게임 데이터/공지 태그로 무효화되는 `'use cache'`를 쓴다. 공개 카탈로그 API는 `lib/constants/http-cache.ts`의 헤더(브라우저 5분, CDN 1시간)를 붙인다. 덱 빌더·수정은 `lib/decks/builder-data.ts`를 공유하며 페이지 언어와 한국어 외의 스킬·패시브 글자와 플레이버를 보내지 않는다.
- **번들:** 플래너의 Tiptap 에디터, 로그인 사용자용 안내 모달, 검색 모달은 필요할 때 불러온다. 검색 모달은 닫힌 채 먼저 마운트한 뒤 열어 첫 열기에도 등장 애니메이션을 유지한다.

검증: 타입 검사, 단위 테스트, `next build` 컴파일 단계. 이 작업 환경은 Supabase 접속이 막혀 프리렌더와 실제 Chrome 화면 검증을 하지 못했다. 배포 전 CI 빌드와 Chrome 하드 리프레시·재방문으로 홈·인격/EGO 목록·인격 상세·키워드 툴팁·덱 빌더를 확인한다.
Chrome 검증 시작 시 Mac은 Cmd+Shift+R, Windows는 Ctrl+Shift+R로 하드 리프레시한다. 이후 일반 새로고침과 페이지 이동에서도 확인한다. 하드 리프레시는 서버 캐시 무효화를 대신하지 않는다.

## UI에서 지킬 동작

- 검색 조건을 적용했다가 해제해도 애니메이션 카드가 opacity 0에 남지 않는지 확인한다. 동적 자식과 whileInView의 재실행을 확인한다.
- UI 버튼 번역뿐 아니라 인격/EGO 이름·설명도 현재 locale로 표시한다. 부모의 locale만 바꾸면 자식 데이터 이름은 그대로일 수 있다.
- ko/en/ja, 모바일 폭, 폰트 크기 조절, reduced motion을 확인한다.
- 운영법의 저장된 토큰에는 한국어/영어/일본어 별칭이 섞일 수 있다. 리팩터링에서 별칭을 없애지 않는다.

공통 모션은 `lib/animations.ts`에서 이동 폭과 전환 시간을 관리한다. 홈의 등장 지연을 줄였고 스크롤/카드 순차 등장 지연은 최대 240ms로 제한한다. 카드 수가 늘어도 마지막 카드가 수 초 동안 기다리지 않도록 한다. 루트 `MotionConfig`와 CSS는 OS의 reduced motion을 따르고, 분석 그래프는 이 설정에서 숫자를 즉시 표시한다. 일반 그래프도 숫자 650ms·막대 480ms, 막대 순차 지연 최대 200ms로 마친다.

거던 이벤트는 원화 갤러리와 선택 결과 탐색 화면으로 구성한다. `EventTab.module.css`는 원본 비율의 원화·기프트 미리보기·검색을 배치하고, `EventModal.module.css`는 큰 원화/설명과 선택지/결과를 데스크톱에서 나란히, 모바일에서 세로로 배치한다. 이벤트 표면·선택 강조·글자색은 전역 `--bg-*`, `--gold*`, `--text-*` 토큰을 사용한다. 목록과 모달의 기프트는 공통 `GiftArtwork`로 같은 원본 배경·등급·키워드 아이콘을 겹쳐 표시한다. 배경은 로딩 성공을 확인할 수 있는 명시적 이미지 레이어이며, 목록 안에는 중첩 버튼을 만들지 않는다. 목록의 기프트 미리보기는 그림만 표시하고 이름은 모달에서 표시한다. 원화는 자르거나 불투명도를 낮추지 않으며 동일 WebP URL을 목록·상세·새 탭 보기에서 재사용한다. 미확정 이미지는 다른 그림이나 큰 빈 상자로 대신하지 않는다.

첫 단계는 `aria-pressed` 선택 버튼으로 전환하며 선택한 결과의 피해·보상·성공/실패를 바로 표시한다. 긴 결과 이야기와 하위 선택지는 네이티브 `details/summary`로 펼친다. 모바일 상단의 선택지 버튼은 해당 영역으로 이동하고 초점을 옮긴다. 기프트는 별도 사각 테두리 없이 원본 배경 위에 놓고, 아래 이름과 .25rem 간격을 둔다. 모달의 그림 폭은 3.75rem이며 이름은 줄바꿈으로 전체 표시한다. 그림·이름 모두 같은 기프트 상세 모달로 연결한다. 결과 전환은 180ms이고 reduced motion에서는 끈다. 탭과 목록은 공통 `getRootEvents`로 실제 진입점 수(154개)를 계산해 하위 결과를 중복 집계하지 않는다.

선택지는 `option_index`로 묶고 각 `result_index`를 그 안에 표시한다. `getEventOutcomes`는 원본 `outcome`을 우선한다. 판정 수치·보정은 `judgment`를 사용하며 결과 문구의 숫자를 추측하지 않는다. 하위 연결은 깊이 제한으로 잘라내지 않고 경로의 재방문을 감지해 앞선 선택으로 돌아가는 버튼을 표시한다. 원본 `<color>`, `<i>`, `<b>`, `<size>`는 안전한 React 노드로 렌더링하며 다른 꺾쇠 대사와 HTML은 텍스트로 유지한다.

원본 폴더가 iCloud의 dataless 상태이면 파일이 빈 내용으로 읽히거나 Git pack 오류가 날 수 있다. 다운로드 완료 전 파일을 덮어쓰거나 삭제하지 않는다. 끝나지 않은 rebase는 임의로 abort하지 않고 기존 작업을 보존한다.

HTTP 통합 검증은 빌드한 서버를 띄운 뒤 실행한다. 기본 단위 테스트에서는 이 검증을 건너뛴다.

```bash
npm run start -- --port 3001
TEST_BASE_URL=http://127.0.0.1:3001 npx vitest run tests/integration/restoration.test.ts
```

EGO 상세는 요청 시 생성한다. 데이터가 없는 복구 환경에서 generateStaticParams가 빈 배열을 반환하면 Cache Components 빌드가 실패하므로 전체 DB 목록을 빌드에 강제하지 않는다. [Next.js 오류 설명](https://nextjs.org/docs/messages/empty-generate-static-params).


## 복구 에셋의 Chrome 점검

복구 DB와 원본 이미지가 연결된 환경에서 프로덕션 빌드 서버를 대상으로 실행한다. DB 재구축 후에는 서버를 재시작하고 `/api/revalidate`에 `all-game-data`와 세 언어의 `/mirror-dungeon` 경로를 전달해 페이지 캐시도 갱신한다. 테스트는 Playwright 번들 Chromium 대신 설치된 Chrome (`channel: 'chrome'`)을 사용한다.

```bash
npm run build
npm run start -- --port 3001
BASE_URL=http://127.0.0.1:3001 LIMBUS_RESTORED_DATA=1 \
  npx playwright test e2e/restored-assets.spec.ts e2e/meta-usage.spec.ts e2e/asset-audit.spec.ts \
  --project=chromium --workers=2 --reporter=line --output=/tmp/limbus-verified-chrome-results
```

`asset-audit.spec.ts`는 한국어 공개 화면·탭 29종을 1440px/390px에서 점검한다. 실제 스크롤로 지연 로딩을 확인하고 CDP `Page.reload({ ignoreCache: true })` 뒤 동일 브라우저 캐시로 다른 페이지를 거쳐 재방문한다. 깨진 이미지·실패한 이미지 응답·가로 넘침·페이지 JavaScript 오류를 검사한다. 영문/일문 키워드·EGO 목록·플래너는 모바일로 추가 점검한다. 각 화면의 스크린샷과 `loaded-artwork.json`에 실제 요청 URL·실패 목록을 남긴다. 출처 미확정 `offense-level.webp`만 실패 응답 예외이며 표시된 깨진 그림은 허용하지 않는다.

상세 회귀는 EGO IV/V 및 침식 탭, 인격 획득 정보·테두리 없는 일러스트, 320/375/430px 스킬 이름표, 파괴 불가 코인, 패닉·수감자 번호, 축복 10개와 공통 별빛, 키워드 모달·툴팁·전역 검색의 실패 처리를 포함한다. `meta-usage.spec.ts`는 집계 조건 변경과 오류 후 재시도를 검증한다. `meta-event-polish.spec.ts`는 보존 플랜의 실제 집계, 1440/390px 하드 리프레시·재방문, 선택지 키보드 조작과 모바일 바로가기, 보상 모달 연결, 3개 언어의 성공/실패 분기와 reduced motion을 검증한다. 원화 감사는 진입점 154개의 확인된 원화 152개를 전부 로드하고 placeholder 및 이미지 실패를 검사하며, 미확정 ID 2개도 명시적으로 확인한다. 원화 ID가 다른 7개 이벤트는 1440/390px에서 목록과 모달의 실제 URL·로딩을 하드 리프레시와 일반 재방문으로 검사한다. 재시도와 4단계 연결, 출혈·충전 기프트, 판정 보정·피해·선행 설명도 검증한다. 갤러리는 초기 화면의 상호작용 준비를 확인한 뒤 카드 6개씩 이미지를 로드한다.

이벤트 재구축 후 빌드·타입 검사와 단위 137개(HTTP 통합 11개 제외)를 통과했다. Chrome 회귀 15개는 14개 통과 후 갤러리의 초기 hydration 대기 방식을 수정하고 해당 1개를 재검증했다. 최신 화면 기록은 `event-restoration-final/`, 전체 갤러리 기록은 `event-gallery-verified/`에 있다.

비로그인 공개 화면의 점검이다. 관리자/계정 내부, 실제 저장·게시·공유 글 상세, 저장된 진행 데이터로 채운 모든 플래너 조합은 이 검사만으로 검증되지 않는다. localhost에서는 서비스 워커가 비활성화되므로 운영 도메인의 SW 업데이트는 별도로 확인해야 한다.

덱 목록은 기존 route `loading.tsx` 경계를 사용한다. 내부의 중복 Suspense 경계와 닫힌 모달의 불필요한 SSR 제외가 초기 렌더링을 중단시키던 부분을 정리했다. 최종 배치·카드 애니메이션은 유지한다. 오프라인/점검 화면은 공통 레이아웃의 `main`을 사용해 중첩된 본문 landmark를 제거했다.

2026-09-10 에셋 복구 당시 확인: 빌드·타입 검사 통과, 단위 117개 통과(HTTP 통합 11개는 기본 실행에서 건너뜀), 원본 에셋 Python 검사 8개 통과, Chrome 79개 통과. 수감자 목록의 명시적 다른 페이지 경유 재방문 2개와 상호작용·다국어 19개도 추가 통과했다. PC/모바일 60개 화면 기록에서 실패한 이미지 응답은 0건이다. 스크린샷·실제 URL 목록·검사 로그는 `../assets/recovery-2026-09-10/chrome-artwork-audit/`에 보존했다. 이는 전체 복구 완료 판정이 아니며 미확정 원본은 [출처와 복구 기록](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/provenance.md)에 남겨 둔다.

이벤트 원화 ID 연결 보완 후 타입 검사, 관련 단위 5개, Chrome 3개(PC/모바일의 7개 원화 하드 리프레시·재방문과 전체 갤러리 로딩)를 통과했다. `event-image-source-review/chrome-verified/`에 화면을 보존했다. 동기화 스크립트와 이미지 데이터 변경으로 앱 빌드는 다시 실행하지 않았다.

## 광기 계획 검증

`BASE_URL=http://localhost:3001 node e2e/lunacy.acceptance.cjs`는 설치된 Chrome으로 월정액 2종·일반 충전 6종의 카드, 초회·재구매 보상, 월간 지급 이월, 무료/유료 구분, 쿠키 복원과 ko/en/ja의 PC·모바일 하드 리프레시·재방문을 검사한다. 화면 기록은 `../assets/recovery-2026-09-10/chrome-lunacy/`에 남긴다. 빌드가 끝난 서버에서 실행하며 검증 도중 `.next`를 다시 빌드하지 않는다.


메타 페이지는 인격 메타 분석 하나만 제공한다. 출처·기간 필터는 같은 도구 모음에 배치하고, 선택 인격 패널 안에서 표본 수와 펼칠 수 있는 집계 기준을 제공한다. 편성 순서·덱 용도·EGO·관심도는 별도 패널로 구분한다. 본문에는 선택한 인격 1개만 표시하며, 변경 모달은 수감자 아이콘 필터·이름 검색·고정 최대 높이를 사용한다. 카드 36개씩 추가로 표시해 데이터가 늘어나도 본문이 밀리지 않는다. 최근 7/30/90일·전체 기간과 게시판 출처를 선택해 공개 전투 편성의 순서, 작성자가 지정한 덱 용도, 같은 수감자에게 장착된 EGO를 집계한다. 기본 EGO 제외는 12개 원본 game_id만 제외하며 ZAYIN 전체를 빼지 않는다. 다중 키워드는 각각 집계한다. 분모는 해당 인격을 전투 편성한 공개 게시물 수이고 실제 전투 사용률·승률이나 방문자 수가 아니다.


홈 공지는 접힌 상태에서 공지사항 표시와 제목만 한 줄로 보여주며 본문은 펼쳤을 때 읽는다. 첫 화면 안에 공지 제목을 유지한다. 히어로는 세로 `_info` 대신 전체 배경을 포함한 원본 일러스트를 사용한다. 원화와 모든 글리치 레이어에 50% 불투명도를 적용하며 PC에서 오른쪽으로 14% 이동한다. 그 위의 좌측 불투명→우측 투명 그라데이션과 하단 음영으로 배경에 연결한다. 원화 비율을 유지해 넓은 PC 화면에서 과도하게 확대하지 않는다.

인격 정보의 `인격 키워드 · 소속`은 해결사 같은 태그와 실제 소속을 표시하되, 원본 `unit_keyword_list`의 내부 크기 분류인 `SMALL`/`소형`은 제외한다. DB 원본 태그와 소속·기프트 계산 데이터는 바꾸지 않는다.

상품 구매마다 초회 여부를 명시적으로 저장한다. 사용자는 앞선 구매와 관계없이 ON/OFF를 선택할 수 있고, 무제한 광기 상품은 한 일정에 1~100회 구매 수량을 입력한다. 초회 ON일 때 1회분만 초회 보상이며 나머지는 일반 보상이다. 과거 구매는 이후 토글 변경으로 다시 계산되지 않는다.

공유 플래너는 보존 JSON의 이전 인격 ID를 게임 ID+수감자로, EGO는 수감자+등급+이름의 고유 일치로 현재 카탈로그에 연결한다. DB 기록을 덮어쓰지 않으며 편성 인격의 스킬·패시브는 동기화 4 원문(없으면 3)을 조회한다. SELECTED/BACKUP 띠는 사용자 제공 PNG 원본을 공통 이미지 함수로 참조하며 원본 바이트와 해시 파일명을 보존한다.


## 입력·커뮤니티 기능 검증

본문·검색·메모는 Pretendard를 우선 사용하고 장식 제목은 기존 제목 폰트를 유지한다. SCDream5 원본에 빈 한글 윤곽을 가리키는 cmap 8,822개가 있어 `scripts/assets/repair-body-font.py --apply`로 제거했다. 매핑이 없는 글자는 대체 폰트로 표시한다. 원본은 복구 폴더 `font-originals/`에 보존한다. 인자 없이 실행하면 빈 한글 매핑이 다시 유입되는지 검사한다.

`e2e/community-additions.spec.ts`는 설치된 Chrome의 PC·모바일 제약 선택, 메모 양식, 임시 저장·재열기, 목록과 전체 필터 전환을 검사한다. `e2e/board-filters.spec.ts`는 덱·플래너 전체 보기의 인격 필터 창(수감자 바꾸기, 고르면 바로 반영, 수감자마다 하나)을 검사한다. 두 게시판의 필터 칸은 `components/board/FilterControls.tsx`의 부품(구역 제목, 글자 선택 버튼, 아이콘 타일, 고른 항목 줄, 입력 칸)으로 만들고, 인격 고르는 창은 플래너 편집기와 같은 `CharacterPickerFilters`를 쓴다. `node e2e/developer-api.acceptance.cjs`는 localhost:3000에서 격리된 테스트 계정으로 키 발급·조회·소유권·폐기·이미지 업로드를 검사한 후 계정과 이미지를 삭제한다. `tests/sql/developer-and-interest.sql`은 트랜잭션 롤백 안에서 요청 제한·RLS 권한·고유 방문 집계를 검사한다.

SEO의 공통 JSON-LD 출력은 next-seo `JsonLdScript`를 사용한다. App Router 제목·canonical·언어별 메타데이터는 기존 Metadata API를 유지한다. 근거: [next-seo custom components](https://github.com/garmeeh/next-seo/blob/main/CUSTOM_COMPONENTS.md).

페이지 메타데이터 규칙:

- 색인 대상 페이지 – `generateMetadata`에서 `lib/seo/metadata.ts`의 `pageMetadata({ lang, path, title, description })`를 돌려준다. canonical·hreflang, Open Graph, Twitter 카드가 그 페이지 값으로 채워진다. 페이지가 `openGraph`를 직접 쓰면 레이아웃의 값(url, type, 사이트 이름, 이미지)이 통째로 사라진다.
- 제목 – 사이트 이름과 `|`를 넣지 않는다(레이아웃 템플릿이 붙인다). 바뀌는 개수(기프트 수 등)를 적지 않는다.
- 색인에서 빼는 화면(로그인, 마이페이지, 글쓰기·수정, 관리자, 점검) – `robots: { index: false, follow: false }`. `robots.txt`는 모든 경로를 허용하므로 페이지가 직접 밝혀야 한다.
- 새 공개 페이지 – `app/sitemap.ts`에 추가한다. `tests/app/page-metadata.test.ts`의 목록에도 넣는다.
- 점검 기록 – [SEO 점검 보고(2026-10-14)](seo-audit-2026-10-14.md).

문의·공지·마이페이지는 상단 메뉴와 약관·저작권만 남긴 작은 푸터를 사용한다. 상단 메뉴 오른쪽에는 검색·언어(아이콘)·알림 종·아바타만 두고, 문의는 아바타 메뉴 항목이다(모바일은 메뉴 시트 아래 줄, 로그인한 경우만). 댓글 알림과 문의 답변은 알림 종의 수와 패널로 보여 준다. 관리자 화면은 전용 탐색 메뉴와 사이트로 돌아가기 링크를 사용하며 일반 메뉴·푸터를 숨긴다. 마이페이지와 공개 프로필은 소개·활동 점수·팔로우를 같은 상단 패널에 배치한다. 마이페이지의 설정은 패널 아래 탭으로 나누며 팔로우 탭과 각각의 목록 공개 스위치를 제공한다.

`npx playwright test e2e/workspace-design.spec.ts --project=chromium`은 PC·모바일에서 공개 범위 스위치, 팔로워 탭 이동, 문의 입력, 개발자 패널 높이·복사, 공지 목록 복귀를 검증한다. 권한은 모의 UI 세션과 별도로 `tests/sql/community-follows.sql`의 롤백 검사와 `node e2e/developer-api.acceptance.cjs`의 격리 계정 HTTP 검사로 확인한다.

메인 첫 화면 아래는 최신 영상·최신 인격·아카이브 바로가기·공식 채널 순서다. 최신 인격 6개는 공통 `IdentityCard`의 compact 표시로 프레임 안 이름을 유지하고 스탯을 숨긴다. PC는 6열, 태블릿은 3열, 모바일은 2열이다. 공식 채널은 본문에서 제공하며 기존 공통 푸터를 유지한다. 지원 브라우저에서는 스크롤 진입 진행률에 따라 섹션 위치·불투명도와 영상 크기가 부드럽게 변한다. 미지원 브라우저에서는 첫 진입 시 280ms 모션으로 대체하고 동작 줄이기 설정에서는 즉시 표시한다.

## 덱·플랜 작성 화면 검증

`/decks/new`와 `/planner`는 로그인 후 접근하며 locale·쿼리를 포함한 복귀 주소를 유지한다. 공개 게시판·상세 조회는 로그인 없이 접근한다. 노트의 스킬 목록은 편성 순서 지정 여부와 관계없이 덱에 선택한 인격만 사용하고 스킬·기프트 카드를 누르면 해당 항목을 삽입하고 모달을 닫는다. 등급 필터는 공통 Dropdown을 사용한다.

로컬 서버를 실행한 뒤 `BASE_URL=http://localhost:3000 node e2e/deck-workspace.acceptance.cjs`로 Chrome 데스크톱·모바일 검증을 실행한다. 로컬 환경의 NextAuth 키로 서명한 테스트 세션과 읽기 전용 게임 조회를 사용하며 게시·DB 변경은 하지 않는다. 화면 캡처는 `/tmp/limbus-workspace-preview`에 저장한다. 외부 경로를 가리키는 node_modules 심볼릭 링크가 Turbopack에서 거부되면 `npm run dev -- --webpack --port 3000`으로 실행한다.

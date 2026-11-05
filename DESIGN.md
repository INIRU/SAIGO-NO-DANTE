# 디자인 기준

최애의 관리자는 림버스 컴퍼니 플레이어가 쓰는 도구 사이트다. 게임 안에서 보던 화면과 같은 비율, 색, 에셋을 그대로 쓰고, 그 위에 정보를 읽기 쉽게 정리한다. 새 화면을 만들거나 고칠 때는 이 문서를 먼저 읽고 아래 공용 컴포넌트를 재사용한다.

실제 값은 `app/globals.css`의 토큰과 각 컴포넌트가 기준이다. 이 문서와 코드가 다르면 코드를 확인하고 문서를 고친다.

## 1. 가장 중요한 원칙

1. **게임과 똑같이.** 인격 카드, 기프트, 테마팩, 스킬 배너, 동기화 단계처럼 게임에 있는 UI는 게임 에셋을 잘라서 쓰고 비율·색·줄바꿈까지 맞춘다. 비슷하게 흉내 낸 CSS 박스나 글자 배지로 대신하지 않는다.
2. **AI가 만든 티가 나면 실패.** 아래 "하지 않는 것"을 지킨다. 설명 문구, 장식용 라벨, 의미 없는 그라데이션을 넣지 않는다.
3. **화면이 튀면 실패.** 로딩, 탭 전환, 선택, 스크롤 중에 레이아웃이 밀리거나 요소가 사라졌다 다시 생기면 안 된다. 자리를 먼저 잡아 두고 내용만 바꾼다.
4. **빠르게.** 클릭 반응은 100ms 안쪽을 목표로 측정한다. 애니메이션을 없애서 빠르게 하지 않고, 불필요한 데이터 로드와 리렌더를 줄여서 빠르게 한다.
5. **PC와 모바일은 따로 설계.** 모바일에서 복잡한 블록은 간결한 변형을 따로 둔다(예: 제약 칩, 가호 타일). 모바일 개선 때문에 PC 화면을 바꾸지 않는다.

## 2. 색

| 용도 | 값 | 토큰 |
| --- | --- | --- |
| 페이지 배경 | `#0d0b08` | `--bg-deep` |
| 패널 배경 | `#120e09` / `#17120c` | `--bg-panel` |
| 카드 배경 | `#1a1510` | `--bg-card` |
| 올라온 면 | `#241c12` | `--bg-elevated` |
| 약한 선 | `#241c14`, `#2e2417` | |
| 기본 테두리 | `#3a2a15` | `--border` |
| 구분선(강조) | `#5a4526` | |
| 입력칸 테두리 | `#86683a` | `--border-control` |
| 금색 강조 | `#c8900a` | `--gold` |
| 밝은 금색 | `#e8b030` | `--gold-light` |
| 본문 글자 | `#e8dcc8` | `--text-primary` |
| 보조 글자 | `#b0a890`, `#9c8b73` | `--text-secondary` |
| 셋째 글자 | `#a89c8a` | `--text-tertiary` |
| 흐린 글자 | `#94887a` | `--text-muted` |
| 오류 글자 | `#ec6a5e` | `--error-text` |
| 익스트림·위험 | `#9b2c23` | |
| 인격 이름(카드 위) | `#f8c000` | |

- 글자는 가장 밝은 면(`--bg-elevated`)에서도 4.5:1 이상, 입력칸 테두리는 3:1 이상을 지킨다(`tests/styles/text-contrast.test.ts`). 가장 어두운 글자는 `--text-muted`다. `#444`, `#555` 같은 회색이나 투명도로 더 흐리게 만들지 않고, 비활성 상태만 예외다.
- 색을 고칠 때는 색조를 유지하고 명도만 올린다. `--error`는 흰 글자를 얹는 면, 글자에는 `--error-text`를 쓴다.
- 갈색·금색 계열 안에서 명도로 층을 나눈다. 파랑·보라 같은 새 강조색을 만들지 않는다.
- 키워드 색은 `GIFT_KEYWORD_COLORS`, 죄악 색은 `SIN_COLORS` 하나만 쓴다. 파일마다 색을 새로 적지 않는다.
- 강화된 기프트 배경(`gift/background-enhanced.webp`)은 주황 줄무늬 슬롯 위에 노란 팔각형을 얹은 게임 슬롯이다(윈도우 추출 도구가 만든다). 아틀라스의 주황 발광 테두리는 선택 표시라서 넣지 않는다. 노란색으로 칠하지 않는다.
- 어시스트의 계획 기프트는 테두리 대신 그룹 제목(이 층 계획 → 최종 기프트 → 그 밖의 기프트)으로 구분한다. 빨간 경고 삼각형은 "테마팩 전용 · 이 층에서 획득"에만 쓴다.
- 노란 경고 삼각형은 거울 던전 체크 모드의 합성 기프트에만 쓴다. 같은 자리(오른쪽 위)에 전용 테마팩이 있는 기프트는 그 팩 그림을 테두리 없이 작게 붙인다.
- 회색조(greyscale) 필터로 비활성 상태를 표현하지 않는다. 투명도나 오버레이를 쓴다.

## 3. 글꼴

| 역할 | 글꼴 | 토큰 |
| --- | --- | --- |
| 숫자, 로고 워드마크 | Bebas Kai | `--font-title`, `--font-logo` |
| 제목, 섹션 이름 | KOTRA Bold | `--font-heading` |
| 본문, 버튼, 입력 | Pretendard | `--font-body` |
| 게임 카드 설명(가호·제약) | S-Core Dream (en/ja는 본문 글꼴) | `--font-game-text` |

- Bebas는 숫자(층, 비용, 편성 번호, 수치)와 로고에만 쓴다. 한글 제목에 쓰지 않는다. `display: optional`이라 미리 받는다(`preload: true`). 안 받으면 첫 방문 내내 대체 글꼴로 남는다.
- 게임 화면을 옮긴 카드는 게임 글꼴을 따른다: 제목 KOTRA Bold, 설명 S-Core Dream, 숫자 Bebas Kai. 강조 단어는 게임 원문의 색 표시를 쓴다(가호: `scripts/data/mark-blessing-terms.py`).
- 영어(`html[lang=en]`)는 제목·본문 모두 Pretendard를 쓴다. 인격 카드 이름은 Mikodacs.
- 일본어(`html[lang=ja]`)는 제목·본문 모두 M PLUS 1p(`--font-noto-jp` 변수), 인격 카드 이름은 Corporate Logo Bold를 쓴다.
- 모든 글꼴은 `public/fonts`에 직접 올려 `next/font/local`로 불러온다(Google Fonts 사용 안 함). 라이선스는 `public/fonts/licenses/`.
- 크기는 `--text-xs`(11px)부터 `--text-xl`(28px)까지의 단계를 쓴다. 페이지 제목은 과하게 키우지 않는다. 거울 던전 소개처럼 한 줄 설명이 붙은 머리말은 작게 둔다.
- 굵기는 제목 700, 본문 400, 강조 600 정도로 제한한다. 모든 글자를 굵게 만들지 않는다.

## 4. 하지 않는 것

- 영어 대문자 소제목(eyebrow), 모노스페이스 라벨, "A · B · C" 식으로 점을 찍어 이어 붙인 문구.
- "당신을 위한", "스마트하게", "한눈에" 같은 설명 문구와 기능을 소개하는 문장. 화면에 필요한 정보와 버튼 이름만 쓴다.
- 이미 사용자가 입력한 내용을 아래에서 다시 요약하는 블록. 편집기 자체가 미리보기 역할을 하게 한다.
- 선택 상태를 테두리 색으로만 표시하기. 게임처럼 SELECTED/BACKUP 배너, 번호를 올린다.
- 호버 때 기프트에 테두리를 두르는 효과, 호버 때 값이 바뀌는 동작. 변경은 클릭으로만 한다.
- 화면을 덮는 "변경" 오버레이, 누르기 전부터 떠 있는 추측성 안내.
- 트렌드("다른 유저들이 N사 덱을 많이 찾아요") 같은 문구. 추천은 결과 목록으로만 보여준다.
- 콘셉트를 억지로 잡은 화면(예: "각성" 연출이 들어간 에러 페이지).
- 계산식·규칙을 풀어 쓴 설명 블록(접힌 "계산 방식"도 포함)과 입력칸마다 붙는 도움말 문장. 도구는 입력, 결과, 상태(불러오는 중·오류·한도) 문구만 둔다. 추정 결과라면 맨 아래 한 줄로만 밝힌다.
- 참고 문서(게임 규칙, 공식 정리)의 내용을 화면에 옮겨 적기. 문서는 계산과 디자인의 근거로만 쓴다.

## 5. 게임 에셋

- 원본은 구글 드라이브 UI 에셋 폴더(https://drive.google.com/drive/folders/1Nk9WWMxEcovs5Ewku5ICT1PbfByNcV_z)와 Supabase Storage `limbus-assets`에 있다. 한 이미지에 여러 UI가 모여 있는 아틀라스가 많으니 필요한 부분을 잘라서 `public/assets` 또는 Storage에 올린다. 잘라낸 스크립트는 `scripts/assets/`에 남긴다.
- 이미지 URL은 `lib/utils/images.ts`의 helper만 쓴다.
- 기프트 등급은 I~IV 이미지(`public/assets/ego-stages/{1..5}.webp`)로 표시한다. 로마 숫자 글자로 쓰지 않는다. 크기는 `GiftGrade`가 맞춘다.
- 기프트 강화는 +/++ 스프라이트와 강화 배경으로 표시한다.
- 동기화(uptie)는 I~IV 이미지로 표시한다. 동기화 I·II는 기본 일러스트, III·IV는 각성(강제 동기화) 일러스트다. 편성의 기본값은 IV다.
- 수감자 로고는 인격 등급(1·2·3성)마다 다른 에셋을 쓴다.
- 인격 이름 줄바꿈은 게임 카드 제목을 따른다(`lib/data/identity-card-titles.json`, `identityNameLines`). 예: "흑수 - 미"는 한 줄.
- 거울 던전 크레딧 아이콘은 아직 찾지 못해 가격을 글자로 쓴다. 에셋을 찾으면 교체한다.
- 사이트 로고는 단테 머리 SVG(`components/brand/DanteLogo.tsx`)다. 내비게이션, 히어로, 파비콘, OG 이미지, 로그인, 에러 페이지가 모두 같은 로고를 쓴다. 예전 로고 이미지는 쓰지 않는다.

## 6. 공용 컴포넌트

새로 만들기 전에 아래에 있는지 먼저 찾는다. 같은 UI를 페이지마다 복제하지 않는다. 플래너가 가장 최신 UI이므로 덱·어시스트 쪽은 플래너 컴포넌트를 가져다 쓴다.

| 용도 | 컴포넌트 |
| --- | --- |
| 인격 카드(프레임, 동기화, SELECTED 배너, 이름) | `components/ui/IdentityFrameCard.tsx` |
| 6×2 편성 보드 | `components/decks/FormationBoard.tsx`, 편집은 `components/planner/deck/PlannerDeckSelection.tsx` |
| 키워드 분포, 패시브, 공격 유형, 죄악 자원 | `components/deck-analysis/DeckInsights.tsx`, `DeckResourceSummary.tsx` |
| 스킬 분포(교환) | `components/planner/SkillExchangePanel.tsx` |
| 기프트 카드, 아트, 등급 | `components/ui/GiftCard.tsx`, `GiftArtwork.tsx`, `GiftGrade.tsx` |
| 기프트 목록(키워드 탭, 등급 칩, 검색) | `components/gifts/GiftCatalog.tsx` |
| 테마팩 카드 | `components/ui/ThemePackCard.tsx` |
| 게시판 필터 칸(구역 제목, 글자 선택 버튼, 아이콘 타일, 고른 항목 줄, 입력 칸) | `components/board/FilterControls.tsx` |
| 인격·E.G.O 고르는 창의 왼쪽 필터(이름 검색, 등급, 수감자) | `components/ui/CharacterPickerFilters.tsx` |
| 층 제약 | `components/planner/FloorConstraints.tsx` |
| 스킬 이름 배너 | `components/skill/SkillNameBanner.tsx` |
| 페이지 머리말, 뒤로 가기 | `components/ui/PageHeader.tsx`, `components/navigation/BackLink.tsx` |
| 모달, 확인창 | `components/ui/BaseModal.tsx`, `ConfirmModal.tsx`, 상세는 `GiftDetailModal`·`ThemePackModal`·`IdentityDetailModal`·`EgoDetailModal` |
| 버튼(주·보조·외곽선·고스트·위험, sm/md, 아이콘만, 처리 중), 버튼 모양 링크 | `components/ui/Button.tsx`(`Button`, `buttonClass()`) |
| 켜기·끄기 설정 | `components/ui/Switch.tsx` |
| 모바일 아래 시트(필터 등) | `components/ui/Sheet.tsx` |
| 키워드 아이콘 | `components/ui/KeywordIcon.tsx` |
| 실패하면 사라지는 이미지 (기프트·테마팩·이벤트 그림, 스킬 아이콘) | `components/ui/QuietImage.tsx` |
| 스켈레톤 | `components/ui/Skeleton.tsx`, `DetailPageSkeleton.tsx` |
| Spine 재생(SD, 풀 일러스트) | `components/spine/SpineStage.tsx` |
| SD 뷰어, 풀 일러스트 창 | `components/identity/SdViewer.tsx`, `IllustViewer.tsx` |
| PNG·GIF·동영상 저장 버튼 | `components/spine/StageSaveButtons.tsx` |

기프트 목록의 키워드 순서는 공통 → 키워드(화상·출혈·진동·파열·침잠·호흡·충전) → 참격·관통·타격이다. 거울 던전 기프트 탭은 사용자가 키워드 순서 창에서 바꾼 순서(브라우저 저장)를 따른다.

## 7. 레이아웃

- **자리를 먼저 잡는다.** 편성 보드, 기프트 격자, 테마팩처럼 크기가 정해진 UI는 로딩 전부터 같은 크기로 자리를 둔다. 슬라이드로 올라오는 편집 패널도 원래 자리의 높이를 유지한다.
- **HTML을 지웠다 다시 그리지 않는다.** 목차가 왼쪽 레일에서 위쪽 막대로 바뀌는 것처럼 형태가 바뀌는 UI는 요소를 유지한 채 스타일만 바꾼다.
- **스크롤 영역은 하나.** 한 화면에 스크롤이 두 개 이상 겹치면 쓰기 어렵다. 긴 패시브처럼 꼭 필요한 곳만 옆 블록과 높이를 맞추고 안에서 스크롤한다.
- **내비게이션 아래 고정.** 스크롤 중 붙어 있어야 하는 목차·필터는 `.sticky-under-nav`를 쓴다. 내비게이션이 내려오면 그 아래로 같이 내려간다.
- **도구 화면은 내비게이션과 푸터를 숨긴다.** 어시스트 실행, 문의, 로그인, 에러, 관리자 화면, 거울 던전 기프트 체크 모드는 `useHtmlFlag`(`hooks/useHtmlFlag.ts`)로 html에 플래그를 달아 숨기고 `100dvh`로 한 화면에 맞춘다. 에러 페이지는 스크롤되지 않는다. 뒤로 가기로 빠져나오면 플래그가 풀려야 한다.
- **전체 폭 블록.** 플래너의 최종 반영 기프트처럼 목차 레일을 무시하고 전체 폭을 쓰는 블록은 레일 폭만큼 음수 여백으로 넓힌다.
- CSS `:has()`로 페이지 전체 상태를 판단하지 않는다. html 데이터 플래그를 쓴다.
- 크기는 rem과 토큰을 쓰고, 이미지 원본 크기와 측정값만 px로 쓴다.

## 8. 움직임

- **움직임은 이 사이트의 특색이다.** 진입, hover, 탭 전환, 순차 등장, 홈 워드마크 같은 움직임은 보는 맛을 만든다. 정리나 최적화를 이유로 빼거나 단조롭게 만들지 않는다. 같은 모습을 더 싼 방법으로 구현한다.
- 움직이는 속성은 `transform`과 `opacity`를 기본으로 한다. 폭·높이·`top`·`left`·여백을 전환하면 매 프레임 레이아웃을 다시 계산한다. 진행 막대는 `transform: scaleX()`, 펼침은 `grid-template-rows`나 `transform`으로 한다.
- `transition-all`을 쓰지 않는다. 바뀌는 속성만 적는다(`transition-colors`, `transition-transform`, `transition-opacity`).
- CSS로 되는 움직임은 CSS로 한다. `motion` 라이브러리는 CSS로 안 되는 것(나가는 애니메이션, 값에 따라 달라지는 순차 등장, 화면 진입 감지)에만 쓴다.
- `motion` 라이브러리는 `m` 컴포넌트로 쓴다(`import * as m from 'motion/react-m'`, `<m.div>`). 기능은 루트의 `components/ui/MotionProvider.tsx`(`LazyMotion`, `domAnimation`)가 한 번 제공한다. 전체 `motion.div`를 쓰면 strict 모드가 오류를 던진다. 드래그나 레이아웃 애니메이션이 필요해지면 그 화면만 `domMax`를 따로 불러온다.
- 화면 밖이거나 숨겨진 요소의 반복 애니메이션과 `requestAnimationFrame` 루프는 멈춘다.
- 움직임을 바꿨으면 전후를 실제 화면으로 비교한다(캡처나 녹화). 숫자만 좋아지고 보는 맛이 줄면 실패다.
- 짧고 조용하게(150~300ms). 요소가 "툭" 튀어나오지 않게 투명도와 약간의 이동을 함께 준다. 오른쪽 아래 스크롤 버튼처럼 나타났다 사라지는 요소도 부드럽게 전환한다.
- 연결된 요소는 같은 타이밍으로 움직인다. 내비게이션과 그 아래 고정 목차가 따로 움직이면 사이가 벌어진다.
- 알림은 사이트 토스트처럼 여러 개가 겹쳐 쌓여 동시에 보이게 한다.
- `prefers-reduced-motion`을 존중한다. 움직임을 끄더라도 정보는 그대로 보인다.
- Spine(SD, 풀 일러스트)은 초당 30장으로 그리고, 화면 밖이거나 탭이 숨겨지면 멈춘다. 풀 일러스트는 눌러서 크게 볼 때만 불러온다. 움직임 줄이기 설정이면 SD는 첫 장면에서 멈추고 풀 일러스트는 정지 그림을 유지한다.
- 홈의 HOSHI ↔ SAIGO 워드마크는 계속 반복되는 애니메이션이다(개발자가 뒤틀려서 최애 HOSHI가 SAIGO가 됐다는 사이트 콘셉트).

## 9. 스켈레톤

- 모든 페이지의 스켈레톤은 실제 페이지와 같은 구조, 같은 CSS 클래스, 같은 크기를 쓴다. 페이지 디자인을 바꾸면 스켈레톤도 같은 커밋에서 바꾼다.
- 스켈레톤도 내비게이션 높이를 비워 둔다. 내비게이션 뒤로 그려지면 안 된다.
- 회색 `animate-pulse` 박스를 새로 쓰지 않는다. `components/ui/Skeleton.tsx`를 쓴다.

## 10. 성능

- HTML은 필요한 만큼만 그린다. 감싸기만 하는 요소를 겹치지 않고, 보이지 않는 탭·접힌 영역은 마운트하지 않거나 `content-visibility`로 건너뛴다.
- CSS는 쓰는 것만 남긴다. 한 컴포넌트만 쓰는 스타일은 그 컴포넌트의 모듈 CSS나 클래스에 두고, `globals.css`에는 여러 화면이 쓰는 토큰과 공용 클래스만 둔다. 안 쓰는 클래스와 `@keyframes`는 지운다.
- 페이지에 필요한 데이터만 불러온다. 전체 인격·기프트 목록은 편집기를 열 때 불러오고, 상세 페이지는 쓰는 필드만 조회한다.
- 게임 데이터의 다국어 필드는 현재 언어만 남겨 보낸다(`lib/i18n/strip-locales.ts`).
- 큰 목록은 점진적으로 렌더링하고(`hooks/useProgressiveRender.ts`), 무거운 섹션은 화면에 들어올 때 마운트한다.
- 입력창(제목 등)은 전체 폼을 다시 그리지 않게 상태를 분리한다. 섹션 컴포넌트는 memo와 안정된 키로 감싼다.
- 외부 임베드(YouTube)는 파사드로 두고, 모니터링 스크립트(Sentry Replay)는 늦게 불러온다.

## 11. 모바일

- 390px 폭에서 확인한다.
- 층 제약은 모바일에서 간결한 칩, PC에서 제약 카드로 보여준다. 선택하지 않은 제약도 모두 보여주고 선택한 것에만 오버레이를 씌운다.
- 가호는 모바일에서 간결한 타일 목록으로 보여준다.
- 모바일 전용 변형은 `sm:hidden` / `hidden sm:block`으로 나누고 PC 쪽 마크업은 건드리지 않는다.

## 12. 문구와 다국어

- 공개 UI는 ko/en/ja를 모두 채운다.
- 한국어가 기준이다. 게임 용어를 그대로 쓴다: 동기화(uptie), 각성 일러스트, 편성, 기프트, 테마팩, 가호, 선택지.
- 버튼은 동사로 짧게 쓴다. 안내 문장은 한 줄로 끝낸다(예: "수감자를 클릭해서 인격을 선택해주세요").
- 사용자 동작마다 성공·실패 토스트를 준다.

## 13. 확인 순서

1. 1440px과 390px 스크린샷을 찍어 게임 화면·기존 페이지와 비교한다.
2. 로딩 중(스켈레톤), 빈 상태, 오류 상태를 확인한다.
3. 클릭 반응 시간을 재고, 스크롤할 때 레이아웃이 흔들리지 않는지 본다.
4. `npx tsc --noEmit`, `npm test`, `npx next build`를 통과시킨다.

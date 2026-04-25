# i18n 구현 — next-intl 마이그레이션

> 영어(en, 기본) / 한국어(ko) / 일본어(ja) 지원. next-intl v4 기반.

## 아키텍처

### URL 구조
- `localePrefix: 'always'` — `/en/sinners`, `/ko/sinners`, `/ja/sinners`
- `defaultLocale: 'en'` — 로케일 없는 URL은 `/en/`으로 리다이렉트

### 핵심 파일
| 파일 | 역할 |
|------|------|
| `lib/i18n/routing.ts` | `defineRouting()` — 로케일, 기본 로케일, 접두사 설정 |
| `lib/i18n/request.ts` | `getRequestConfig()` — 서버 사이드 로케일 결정 + 메시지 로드 |
| `lib/i18n/navigation.ts` | `createNavigation(routing)` — `Link`, `useRouter`, `usePathname`, `redirect` |
| `messages/ko.json` | 한국어 UI 번역 (nested JSON) |
| `messages/en.json` | 영어 UI 번역 |
| `messages/ja.json` | 일본어 UI 번역 |
| `proxy.ts` | next-intl 미들웨어 (`createMiddleware(routing)`) + `preferred_lang` → `NEXT_LOCALE` 마이그레이션 |

### 레이아웃 구조
```
app/layout.tsx          — <html lang="en"> + 폰트 + 전역 프로바이더
app/[lang]/layout.tsx   — NextIntlClientProvider + SetHtmlLang + Navbar/Footer
```

- `app/layout.tsx`: `<html lang="en" suppressHydrationWarning>` 고정 (getLocale() 사용 시 블로킹 렌더 발생)
- `app/[lang]/layout.tsx`: `SetHtmlLang` 컴포넌트가 useEffect로 `document.documentElement.lang` 업데이트 (하이드레이션 이후)
- `NextIntlClientProvider`에 `locale`, `messages`, `now`, `timeZone` 명시 필수

### 번역 유형

#### 1. UI 텍스트 (next-intl messages)
- `useTranslations()` / `getTranslations()` 사용
- `messages/{locale}.json` 파일에서 로드
- ICU 메시지 포맷: `t('key', { n: 1 })` (`.replace()` 사용 금지)

#### 2. 게임 데이터 (DB 컬럼)
- `name_en`, `name_jp` 등 DB 컬럼에 저장
- `getLocalizedName(item, lang)`, `getLocalizedAffiliation()` 등 헬퍼 사용
- `lib/i18n/index.ts`의 유틸 함수로 로케일별 데이터 반환

#### 3. AI 요약 (언어별 생성)
- 선택 언어로 AI 프롬프트 전송 → 해당 언어 응답 캐싱
- `IdentityAISection.tsx`에서 locale 기반 요약 요청

### 'use cache' 페이지 주의사항
- `'use cache'` + next-intl `Link` = `headers()` 충돌
- 해결: 해당 페이지에서 `import Link from 'next/link'` 사용 (미들웨어가 리다이렉트 처리)
- 영향 파일: `decks`, `story`, `story/prologue`, `story/[chapterId]`, `terms`, `privacy`, `announcements`, `offline`

### 클라이언트 컴포넌트 네비게이션
- `useRouter`, `usePathname` → `@/lib/i18n/navigation`에서 import (로케일 접두사 자동 처리)
- `useSearchParams`, `useParams`, `notFound` → `next/navigation`에서 import (로케일 무관)

## 데이터 동기화

### EGO 스킬/패시브 EN/JP
- `scripts/sync/identity-data.ts`에서 `loadEgoSkillLocale()`, `loadEgoPassiveLocale()` 사용
- 게임 로케일 파일: `assets/data/kr/KR_Skills_Ego.json`, `EN_Skills_Ego.json`, `JP_Skills_Ego.json`

### EGO 획득 방법
- `obtaining_method` (한국어 수동 입력)
- `EGODetailClient.tsx`의 `localizeObtainingMethod()` 함수로 클라이언트 사이드 번역
- 키워드 매핑: 기본, 추출, 특정 추출, 배틀 패스, 정기검진, 자아 파편 등

## 2026-04-24 거울 던전 테마팩 탭

### 요구사항
- `REQ-MD-THEME-I18N-001`: `/[lang]/mirror-dungeon?tab=themes` 테마팩 카드, 검색 자동완성, 필터 결과, 히든 테마팩 카드가 `ego_gift_themes.name_en/name_jp`를 사용하고 누락 시 한국어 이름으로 폴백한다.
- `REQ-MD-THEME-I18N-002`: 테마팩 상세 모달의 제목, 출현 정보, 키워드 분포, 관련 이벤트/기프트 카드 이름은 현재 locale 기준으로 표시한다.
- `REQ-MD-THEME-I18N-003`: 테마팩 이름 번역은 다음 데이터 동기화에서도 보존되도록 `scripts/sync/mirror-dungeon-data.ts`가 EN/JP `MirrorDungeonTheme` 소스에서 `name_en/name_jp`를 채운다.
- `REQ-MD-THEME-I18N-004`: 테마팩 상세 모달의 기프트 카드 그리드는 기프트 탭과 같은 `GiftCard` 밀도와 크기 규칙을 사용해 UI 이질감을 줄인다.
- `REQ-MD-EVENT-I18N-001`: `/[lang]/mirror-dungeon?tab=events` 이벤트 카드, 검색, 이벤트 상세 모달은 `md_events.name_en/name_jp`, `desc_text_en/desc_text_jp`를 사용하고 누락 시 한국어로 폴백한다.
- `REQ-MD-EVENT-I18N-002`: 이벤트 이름/설명 번역은 다음 데이터 동기화에서도 보존되도록 `scripts/sync/mirror-dungeon-data.ts`가 EN/JP Action/AbEvent 소스에서 `md_events.name_en/name_jp`, `desc_text_en/desc_text_jp`를 채운다.
- `REQ-MD-EVENT-I18N-003`: 선택지 본문, 선택지 부가 설명, 결과 텍스트는 `md_event_choices.message_en/message_jp`, `message_desc_en/message_desc_jp`, `result_text_en/result_text_jp`를 사용하고 누락 시 한국어로 폴백한다.
- `REQ-MD-EVENT-I18N-004`: 선택지 번역은 다음 데이터 동기화에서도 보존되도록 `scripts/sync/mirror-dungeon-data.ts`가 EN/JP Action/AbEvent 소스에서 선택지별 EN/JP 컬럼을 채운다.
- `REQ-MD-EVENT-CHAIN-001`: `md_event_choices.next_event_id`와 `effects`는 게임 소스의 `nextEventID`/result effects에서 생성되어, child dialogue event가 이벤트 카드 목록이 아니라 parent 이벤트 모달 안에 중첩 렌더된다.
- `REQ-MD-EVENT-POOL-001`: 이벤트 동기화 대상은 현재 테마팩 `eventPool`/`specialEventPool`에 직접 포함된 root와 그 `nextEventID` child로 제한한다. 과거 ActionEvents locale row나 legacy dungeon nodepool row만으로는 root 이벤트를 생성하지 않는다.
- `REQ-MD-EVENT-EFFECT-I18N-001`: 이벤트 상세 모달의 choice effect 문장과 effect 내부 GiftCard 이름은 현재 locale 기준으로 렌더링한다.
- `REQ-MD-EVENT-CANONICAL-001`: 현재 pool에 중복 등록된 동일 visible root 이벤트는 source 근거가 명확한 경우에만 canonical winner를 유지하고 loser root/child를 DB target에서 제외한다.

### 구현 메모
- 테마팩 DB 컬럼은 `name_en`, `name_jp`를 이미 보유한다.
- 이벤트 DB 컬럼은 `md_events.name_en`, `name_jp`, `desc_text_en`, `desc_text_jp`를 이미 보유한다.
- `md_event_choices` 선택지별 EN/JP 컬럼은 `20260424_md_event_choice_i18n.sql` migration 적용 후 사용 가능하다.
- DB 쓰기 금지 작업에서는 migration apply, `--fix`, update/upsert/delete를 실행하지 않는다. migration과 event choice sync는 사용자 승인 후 별도 실행한다.
- UI 컴포넌트는 `getLocalizedName({ name_kr, name_en, name_jp }, lang)` 패턴을 따른다.
- Supabase 쓰기 스크립트는 이 변경에서 실행하지 않는다. 실제 DB 반영은 별도 승인 후 `--themes-only --fix`, `--events-only --fix`로 처리한다.

### Requirement Traceability
| Requirement | Evidence | Result |
|-------------|----------|--------|
| `REQ-MD-THEME-I18N-001` | `components/ui/ThemePackCard.tsx`, `components/mirror-dungeon/ThemeTab.tsx`; `npx tsc --noEmit --pretty false --incremental false`; `git diff --check` | pass |
| `REQ-MD-THEME-I18N-002` | `components/mirror-dungeon/ThemeModal.tsx`, `app/[lang]/mirror-dungeon/page.tsx`; `npx tsc --noEmit --pretty false --incremental false`; `git diff --check` | pass |
| `REQ-MD-THEME-I18N-003` | `scripts/sync/mirror-dungeon-data.ts`; `set -a; source .env.local; set +a; npx --yes tsx scripts/sync/mirror-dungeon-data.ts --themes-only --dry-run` | pass |
| `REQ-MD-THEME-I18N-004` | `components/mirror-dungeon/ThemeModal.tsx`; `@browser-use` visual smoke on `/en/mirror-dungeon?tab=themes` | pending |
| `REQ-MD-EVENT-I18N-001` | `components/mirror-dungeon/EventTab.tsx`, `components/mirror-dungeon/EventModal.tsx`; `npx tsc --noEmit --pretty false --incremental false`; `git diff --check` | pass |
| `REQ-MD-EVENT-I18N-002` | `scripts/sync/mirror-dungeon-data.ts`; `npx --yes tsx scripts/sync/mirror-dungeon-data.ts --events-only --dry-run` | pass |
| `REQ-MD-EVENT-I18N-003` | `components/mirror-dungeon/types.ts`, `app/[lang]/mirror-dungeon/MirrorDungeonClient.tsx`, `components/mirror-dungeon/EventTab.tsx`, `components/mirror-dungeon/EventModal.tsx`; `npx tsc --noEmit --pretty false --incremental false` | pass |
| `REQ-MD-EVENT-I18N-004` | `supabase/migrations/20260424_md_event_choice_i18n.sql`, `scripts/sync/mirror-dungeon-data.ts`; `npx --yes tsx scripts/sync/mirror-dungeon-data.ts --events-only --dry-run` | pass |
| `REQ-MD-EVENT-CHAIN-001` | `scripts/sync/mirror-dungeon-data.ts`, `components/mirror-dungeon/EventTab.tsx`, `components/mirror-dungeon/EventModal.tsx`; dry-run 선택지 대상 로그의 `next_event_id`/`effects` 카운트 | pass |
| `REQ-MD-EVENT-POOL-001` | `npx --yes tsx scripts/sync/mirror-dungeon-data.ts --events-only --dry-run --dump-events=/tmp/md-events-target.json`; target excludes `900011/900012/900013` and `910301/910302`, keeps `971001/971003` | pass |
| `REQ-MD-EVENT-EFFECT-I18N-001` | `components/mirror-dungeon/EventModal.tsx`; `npx tsc --noEmit --pretty false --incremental false`; DB choice/gift locale verification | pass |
| `REQ-MD-EVENT-CANONICAL-001` | Source comparison for `971105/971107`; `971107.illustId = 971105`; `npx --yes tsx scripts/sync/mirror-dungeon-data.ts --events-only --dry-run`; Supabase verification after `--fix` | pass |

### 검증 메모
- Design audit P2 2건은 기존 테마팩 그리드/모달 구조에 대한 템플릿 위험 신호다. 이번 변경 범위는 텍스트/데이터 로컬라이즈이므로 레이아웃 재설계는 제외한다.
- 테마팩 dry-run은 KR/EN/JP `MirrorDungeonTheme` 소스 각각 105개를 읽고, 현재 로드 대상 104개 테마의 `name_en/name_jp` 변경을 감지했다. 일부 기존 `floor_info` 차이도 함께 감지되지만 DB 쓰기는 실행하지 않았다.
- `npm run dev -- --webpack --port 3020` + Playwright smoke on `/en/mirror-dungeon?tab=themes` → page loaded with no console/page errors. Turbopack dev cannot run with worktree `node_modules` symlink that points outside the project root, so webpack mode is the local QA path for this worktree.
- `@browser-use` in-app browser smoke on `/en/mirror-dungeon?tab=themes` → tab/search/filter/modal labels are localized in EN and no console errors were reported. Theme names still render in KR until the dry-run-confirmed `ego_gift_themes.name_en/name_jp` DB update is applied.
- 이벤트 dry-run은 현재 테마팩 `eventPool`/`specialEventPool` root 153개와 `nextEventID` child 165개로 총 318개 이벤트, 선택지 대상 713개를 생성했고, 이 중 유효한 `next_event_id` 169개, `effects` 545개, EN 선택지 713개, JP 선택지 713개를 확인했다. 현재 타겟 밖을 가리키는 source `nextEventID` 8종은 FK 삽입 전에 제거한다. `900011/900012/900013` 빈 공간 legacy 이벤트와 `910301/910302` legacy 치킨 이벤트는 타겟에서 제외되고, 현재 테마풀의 `971001/971003` 치킨/탱고 이벤트만 유지된다.
- `971105/971107` 야수파 약지 갤러리는 theme 1126 current eventPool에 둘 다 존재하지만 root visible text가 동일하고 `971107.illustId`가 `971105`를 가리킨다. 보상 차이가 있어 광범위한 text-merge는 금지하고, source-grounded canonical loser `971107`만 제외한다.
- canonical exclusion 적용 후 이벤트 dry-run은 총 316개 이벤트, 선택지 709개, 유효한 `next_event_id` 168개를 생성한다. Supabase 검증 결과 야수파 약지 갤러리는 root `971105`와 child `97110501`만 남고 `971107/97110701`은 삭제되었다.
- `npx tsc --noEmit --pretty false --incremental false` 및 `git diff --check` 통과. 이 작업에서는 DB 쓰기, migration apply, `--fix` 실행을 하지 않았다.
- Playwright smoke on `/en/mirror-dungeon?tab=events` using the existing webpack dev server at `localhost:3020` returned HTTP 200, `Mirror Dungeon` title, first event card `In an empty space,`, and 0 console/page errors.

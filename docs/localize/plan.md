# i18n 구현 계획

> 영어(en) / 일본어(ja) 지원 추가. 기존 한국어(ko) 기본 유지.

## 현황

commit #149에서 i18n 인프라가 WIP로 추가됨:
- `lib/i18n/` — LanguageContext, translations, types (ko/en/ja)
- `components/ui/LanguageSwitcher.tsx` — 언어 전환 드롭다운 UI
- `supabase/migration-i18n.sql` — DB 스키마 (lang 컬럼, game_translations, ai_summaries)

**미연결 상태:**
- LanguageProvider가 app/layout.tsx에 미적용
- LanguageSwitcher가 Navbar에서 주석처리
- API 라우트에 lang 파라미터 미구현
- 페이지 컴포넌트에 번역 미적용

---

## 핵심 콘텐츠 분류

### A. 로컬 전용 콘텐츠 (선택 언어만 표시)

사용자가 선택한 언어의 콘텐츠만 보여줌. 다른 언어 콘텐츠는 완전히 숨김.

| 콘텐츠 | 이유 |
|--------|------|
| **운영법 (Identity Guides)** | 공략/가이드 특성상 자국어만 유의미 |
| **AI 요약** | 언어별로 생성/캐싱되며 자국어만 필요 |
| **공지사항** | 사이트 운영 정보이므로 선택 언어 전용 |

### B. 필터 기반 콘텐츠 (언어 필터 제공)

기본값: 내 언어. 필터로 "모든 언어" / "특정 언어" 전환 가능.

| 콘텐츠 | 이유 |
|--------|------|
| **덱 게시판** | 다국어 유저 간 덱 공유 가치 있음 |
| **커뮤니티 플랜 (거던 플래너)** | 다른 언어권 플랜도 참고 가치 있음 |
| **티어 리스트** | 투표 데이터는 언어 무관하지만 댓글은 언어별 |

### C. 게임 데이터 (번역 오버레이)

DB의 `game_translations` 테이블로 번역. 한국어 원본에 EN/JA 오버레이.

| 대상 | 테이블 |
|------|--------|
| 인격 이름/설명 | identities → game_translations |
| EGO 이름/설명 | ego → game_translations |
| 스킬명 | skills → game_translations |
| 패시브명 | passives → game_translations |
| 키워드명/설명 | keyword_meta → game_translations |
| EGO 기프트명 | ego_gifts → game_translations |

### D. 정적 UI (번역 키)

`lib/i18n/translations.ts`의 키로 처리. 이미 ko/en/ja 준비됨.

---

## 구현 단계

### Phase 1: 인프라 연결 (Foundation)

i18n 기반을 앱에 연결하고 모든 페이지에서 언어 전환 가능하게 함.

#### 1-1. LanguageProvider 연결
- `app/layout.tsx`에 `<LanguageProvider>` 추가 (Providers 스택에)
- SessionProvider, KeywordProvider 등과 함께 최상위에 배치

#### 1-2. LanguageSwitcher 활성화
- `components/layout/Navbar.tsx`에서 LanguageSwitcher 주석 해제
- 데스크톱: 네비게이션 바 우측에 배치
- 모바일: 사이드 메뉴 내부에 배치

#### 1-3. 언어 설정 DB 동기화
- 로그인 유저: `profiles.preferred_lang` 저장/로드
- 비로그인 유저: localStorage만 사용 (현재 구현 유지)
- 로그인 시 profiles에서 preferred_lang 읽어서 Context 동기화

#### 1-4. translations.ts 확장
- 누락된 페이지별 번역키 추가:
  - `announcements.*` — 공지사항 관련
  - `tierList.*` — 티어리스트 관련
  - `extraction.*` — 추출 시뮬레이션
  - `random.*` — 랜덤 편성
  - `collection.*` — 보유 현황
  - `meta.*` — 메타 정보
  - `filter.*` — 필터 관련 (언어 필터 포함)
  - `error.*` — 에러 메시지
  - `auth.*` — 인증 관련

---

### Phase 2: 로컬 전용 콘텐츠 (Locale-Only)

선택 언어만 보이는 콘텐츠 처리.

#### 2-1. 운영법 (Identity Guides)
- **페이지**: `/sinners/[id]/[identityId]` 내 가이드 탭
- **API**: `GET /api/guides?identity_id=X&lang=ko`
  - lang 파라미터 필수. 사용자의 preferred_lang만 쿼리
  - `WHERE lang = $lang` 조건 추가
- **작성**: `POST /api/guides` 에 `lang` 필드 포함
  - 작성 시 현재 선택 언어로 자동 설정
- **UI 변경 없음**: 필터 UI 불필요 (자동으로 내 언어만)

#### 2-2. AI 요약
- **API**: `GET /api/identity-ai?identity_id=X&lang=ko`
  - lang별로 별도 캐시 (identity_ai_summaries에 lang 컬럼 이미 존재)
  - 해당 언어 요약 없으면 "아직 요약이 없습니다" 표시
- **생성**: `POST /api/identity-ai` 에 `lang` 포함
  - 시스템 프롬프트를 언어별로 분기:
    - ko: 현재 한국어 프롬프트 유지
    - en: 영어 프롬프트 (English analysis format)
    - ja: 일본어 프롬프트 (日本語分析フォーマット)
  - 생성된 요약을 해당 lang으로 저장
- **UI**: 현재 언어의 AI 요약만 표시

#### 2-3. 공지사항
- **DB**: `announcements` 테이블에 `lang` 컬럼 추가 (migration-i18n.sql에 없음 → 추가 마이그레이션)
- **API**: `GET /api/announcements?lang=ko`
  - lang 파라미터로 필터링
  - 핀된 공지 + 일반 공지 모두 lang 필터 적용
- **관리자**: 공지 작성 시 언어 선택 (같은 공지를 여러 언어로 작성 가능)

---

### Phase 3: 필터 기반 콘텐츠 (Filter-Based)

언어 필터를 제공하는 UGC 페이지.

#### 3-1. 언어 필터 컴포넌트
- **새 컴포넌트**: `components/ui/LanguageFilter.tsx`
- **필터 옵션**:
  - `내 언어만` (기본값) — user의 preferred_lang
  - `모든 언어` — lang 필터 없이 전체
  - `한국어` / `English` / `日本語` — 특정 언어 선택
- **UI**: 기존 필터 바에 드롭다운/탭 형태로 추가
- **상태**: URL 쿼리 파라미터 (`?lang=ko`, `?lang=all`) 또는 클라이언트 상태

#### 3-2. 덱 게시판
- **페이지**: `/decks`
- **API**: `GET /api/decks?lang=ko` (기본), `GET /api/decks` (전체)
  - lang 파라미터: 'ko' | 'en' | 'ja' | 'all' | undefined
  - undefined/all → 필터 없이 전체 반환
  - 특정 lang → `WHERE lang = $lang`
- **작성**: `POST /api/decks` 에 `lang` 자동 포함 (현재 선택 언어)
- **목록 UI**:
  - 각 덱 카드에 언어 뱃지 표시 (🇰🇷 / 🇺🇸 / 🇯🇵 또는 KO/EN/JA)
  - 필터 바에 LanguageFilter 추가
- **상세 UI**: 덱 상세 페이지는 언어 무관 (이미 선택해서 들어옴)

#### 3-3. 커뮤니티 플랜 (거던 플래너)
- **페이지**: `/planner` (커뮤니티 탭)
- **API**: `GET /api/planner?lang=ko` (기본), `GET /api/planner` (전체)
  - 덱 게시판과 동일한 필터 로직
- **작성**: `POST /api/planner` 에 `lang` 자동 포함
- **목록 UI**:
  - 플랜 카드에 언어 뱃지 표시
  - 기존 난이도/태그 필터 옆에 LanguageFilter 추가
- **플래너 도구 자체**: 언어와 무관 (게임 데이터는 Phase 4에서 번역)

#### 3-4. 티어 리스트
- **페이지**: `/tier-list`
- **투표 데이터**: 언어 무관 (전체 유저 투표 합산)
- **댓글/의견**: lang 필터 적용 가능 (향후)
- **우선순위 낮음**: Phase 3에서 UI 번역만, 필터는 추후

---

### Phase 4: 게임 데이터 번역 (Game Data Translation)

DB의 game_translations 테이블을 활용한 정적 게임 데이터 번역.

#### 4-1. 번역 데이터 Sync 스크립트
- `scripts/sync-translations.mjs` 활용 (이미 존재)
- EN/JA 게임 데이터 소스:
  - EN: `/Users/iniru/Documents/Limbus/assets/data/` 내 EN locale 파일
  - JA: 동일 경로 내 JA locale 파일
- Sync 대상: identity, ego, skill, passive, keyword, ego_gift 이름/설명
- `game_translations` 테이블에 upsert

#### 4-2. 번역 쿼리 헬퍼
- **새 유틸**: `lib/db/translated-query.ts`
- 기본 패턴:
  ```sql
  SELECT i.*, 
    COALESCE(gt.name, i.name) as display_name,
    COALESCE(gt.description, i.description) as display_description
  FROM limbus.identities i
  LEFT JOIN limbus.game_translations gt 
    ON gt.entity_type = 'identity' 
    AND gt.entity_id = i.game_id::text 
    AND gt.lang = $lang
  ```
- lang='ko'이면 LEFT JOIN 스킵 (원본이 한국어)

#### 4-3. 적용 페이지
- 수감자 목록/상세 (`/sinners/[id]`, `/sinners/[id]/[identityId]`)
- EGO 목록/상세
- 스킬/패시브 표시
- 키워드 사전 (`/keywords`)
- 추출 시뮬레이션 (`/extraction`)
- 랜덤 편성 (`/random`)
- 보유 현황 (`/collection`)
- 거울 던전 플래너 (기프트/테마팩 이름)
- 덱 상세 (인격/EGO 이름)

#### 4-4. 우선순위
1. 인격 이름 (가장 자주 표시)
2. EGO 이름
3. 스킬/패시브 이름
4. 키워드 이름/설명
5. EGO 기프트 이름

---

### Phase 5: 페이지별 메타데이터 & UI 번역

모든 페이지의 하드코딩된 한국어 문자열을 번역키로 교체.

#### 5-1. 메타데이터 (SEO)
- 각 page.tsx의 `metadata` / `generateMetadata` 에서 title/description 번역
- **문제**: generateMetadata는 서버 컴포넌트 → Context 사용 불가
- **해결**: cookie 또는 searchParams에서 lang 읽기
  - `cookies().get('preferred_lang')` 또는 `?lang=ko` 파라미터
  - LanguageContext에서 setLang 시 cookie도 동기화

#### 5-2. 서버 컴포넌트 번역
- 서버 컴포넌트에서는 Context 사용 불가
- **해결**: `lib/i18n/server.ts` 유틸 생성
  - `getServerLang()`: cookies에서 preferred_lang 읽기
  - `serverT(key, lang)`: 서버용 번역 함수
- 서버 컴포넌트 page.tsx에서 사용

#### 5-3. 클라이언트 컴포넌트 번역
- 기존 `useLanguage()` 훅의 `t()` 함수 사용
- 모든 하드코딩된 문자열을 `t('key')` 로 교체

#### 5-4. 적용 범위
- Navbar — 메뉴 라벨
- 각 페이지 제목/설명
- 공통 버튼/액션 텍스트
- 에러 메시지
- 빈 상태 메시지
- 필터/정렬 라벨

---

## DB 마이그레이션 요약

### 이미 준비됨 (migration-i18n.sql)
- `profiles.preferred_lang` VARCHAR(5) DEFAULT 'ko'
- `decks.lang` VARCHAR(5) DEFAULT 'ko'
- `md_plans.lang` VARCHAR(5) DEFAULT 'ko'
- `identity_guides.lang` VARCHAR(5) DEFAULT 'ko'
- `game_translations` 테이블
- `ai_summaries` 테이블
- `identity_ai_summaries.lang` 컬럼
- 관련 인덱스/RLS/RPC

### 추가 필요
- `announcements.lang` VARCHAR(5) DEFAULT 'ko'
- `idx_announcements_lang` 인덱스

---

## 파일 변경 범위

### 신규 파일
| 파일 | 용도 |
|------|------|
| `components/ui/LanguageFilter.tsx` | UGC 언어 필터 드롭다운 |
| `lib/i18n/server.ts` | 서버 컴포넌트용 번역 유틸 |
| `lib/db/translated-query.ts` | 게임 데이터 번역 쿼리 헬퍼 |
| `supabase/migration-i18n-v2.sql` | announcements.lang 추가 |

### 수정 파일 (인프라)
| 파일 | 변경 |
|------|------|
| `app/layout.tsx` | LanguageProvider 추가 |
| `components/layout/Navbar.tsx` | LanguageSwitcher 활성화 |
| `lib/i18n/translations.ts` | 누락 번역키 추가 |
| `lib/i18n/LanguageContext.tsx` | cookie 동기화 추가 |

### 수정 파일 (API 라우트)
| 파일 | 변경 |
|------|------|
| `app/api/decks/route.ts` | lang 필터 파라미터 |
| `app/api/planner/route.ts` | lang 필터 파라미터 |
| `app/api/guides/route.ts` | lang 필수 파라미터 |
| `app/api/identity-ai/route.ts` | lang별 생성/캐시 |
| `app/api/announcements/route.ts` | lang 필터 파라미터 |

### 수정 파일 (페이지 — Phase 5)
| 파일 | 변경 |
|------|------|
| `app/decks/page.tsx` | 메타 번역 + LanguageFilter |
| `app/planner/page.tsx` | 메타 번역 + LanguageFilter |
| `app/announcements/page.tsx` | 메타 번역 + lang 필터 |
| `app/tier-list/page.tsx` | 메타 번역 |
| `app/extraction/page.tsx` | 메타 번역 |
| `app/random/page.tsx` | 메타 번역 |
| `app/collection/page.tsx` | 메타 번역 |
| `app/sinners/*/page.tsx` | 게임 데이터 번역 |
| `app/keywords/page.tsx` | 게임 데이터 번역 |

### 수정 파일 (클라이언트 컴포넌트 — Phase 5)
- 각 페이지의 Client 컴포넌트들 (`DecksClient`, `PlannerClient`, etc.)
- 하드코딩 문자열 → `t()` 교체

---

## 구현 순서 및 우선순위

```
Phase 1 (인프라)     ← 모든 후속 Phase의 전제조건
  ↓
Phase 2 (로컬 전용)  ← 가이드, AI 요약, 공지 (엄격 필터)
  ↓
Phase 3 (필터 기반)  ← 덱 게시판, 커뮤니티 플랜 (유연 필터)
  ↓
Phase 4 (게임 번역)  ← 인격/EGO/스킬 등 정적 데이터 번역
  ↓
Phase 5 (UI 번역)   ← 전체 페이지 메타/문자열 번역
```

**MVP 범위**: Phase 1 + Phase 2 + Phase 3
- 가장 핵심적인 UGC 필터링 + 언어 전환 UI
- 게임 데이터 번역(Phase 4)과 전체 UI 번역(Phase 5)은 후속

---

## 기술 결정

### URL 기반 라우팅 vs Context 기반
- **선택: Context 기반** (현재 구현)
- 이유: URL 라우팅(`/en/decks`)은 모든 라우트 리팩토링 필요 → 과도한 변경
- localStorage + cookie로 언어 상태 유지
- 서버 컴포넌트는 cookie에서 읽음

### 외부 라이브러리 vs 커스텀 구현
- **선택: 커스텀 유지** (현재 `lib/i18n/`)
- 이유: next-intl 등은 URL 라우팅 전제 → 현재 아키텍처와 충돌
- 번역키 수가 적당 (~200개 이내) → 커스텀으로 충분

### 기본 언어 필터 동작
- **로컬 전용 콘텐츠**: 내 언어만 (변경 불가)
- **필터 기반 콘텐츠**: 기본값 "내 언어만", 사용자가 "모든 언어"로 전환 가능
- **게임 데이터**: 항상 내 언어로 표시 (번역 없으면 한국어 폴백)

### 기존 데이터 처리
- migration 시 기존 데이터는 모두 `lang = 'ko'`로 기본값
- 기존 UGC(덱, 플랜, 가이드)는 한국어로 간주

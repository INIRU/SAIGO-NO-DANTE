# 기술 아키텍처

## 기술 스택

```
┌─────────────────────────────────────────────────────┐
│                      Vercel                         │
│  ┌───────────────────────────────────────────────┐  │
│  │           Next.js 16 (App Router)             │  │
│  │  ┌─────────────┐  ┌───────────┐  ┌─────────┐ │  │
│  │  │   React 19  │  │ Tailwind 4│  │  GSAP   │ │  │
│  │  │  Zustand    │  │           │  │ Framer  │ │  │
│  │  │  SWR / nuqs │  │           │  │ Motion  │ │  │
│  │  └─────────────┘  └───────────┘  └─────────┘ │  │
│  └───────────────────────────────────────────────┘  │
│                         │                           │
│                         ▼                           │
│  ┌───────────────────────────────────────────────┐  │
│  │              Supabase (PostgreSQL)            │  │
│  │         스키마: limbus.* │ Storage: limbus-assets│  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

| 계층 | 기술 | 역할 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | SSR/SSG/ISR, 라우팅, API Routes |
| UI | React 19, Tailwind CSS v4 | 컴포넌트, 스타일링 |
| 상태 관리 | Zustand, SWR, nuqs | 클라이언트 상태, 데이터 페칭, URL 상태 |
| 애니메이션 | GSAP, Framer Motion | 페이지 전환, 슬롯머신, 호버 효과 |
| 3D | Three.js | 히어로 페이지 3D 효과 |
| 유효성 검사 | Zod v4 | 스키마 기반 데이터 검증 |
| 데이터베이스 | Supabase (PostgreSQL) | `limbus` 스키마, RLS |
| 인증 | NextAuth v4 + Google OAuth | 로그인, 세션 관리 |
| 스토리지 | Supabase Storage | `limbus-assets` 버킷 (이미지) |
| 모니터링 | Sentry, Vercel Analytics | 에러 트래킹, 사용자 분석 |
| 배포 | Vercel | 자동 빌드/배포, Edge Network |
| 테스트 | Vitest, Playwright | 단위 테스트, E2E 테스트 |

---

## 프로젝트 구조

```
limbus-archive/
├── app/                        # App Router 페이지 + API
│   ├── layout.tsx              # 루트 레이아웃 (Providers, Navbar, Footer)
│   ├── page.tsx                # 히어로 페이지 (GSAP 애니메이션)
│   ├── globals.css             # 글로벌 CSS (Tailwind)
│   ├── sinners/                # 죄수/인격/E.G.O 페이지
│   ├── mirror-dungeon/         # 거울 던전 백과사전
│   ├── decks/                  # 덱 빌더 + 상세 + 편집
│   ├── collection/             # 컬렉션 체크리스트
│   ├── tier-list/              # 리롤 티어 리스트
│   ├── extraction/             # 뽑기 시뮬레이터
│   ├── random/                 # 랜덤 편성
│   ├── mypage/                 # 마이페이지
│   ├── admin/                  # 관리자 페이지
│   ├── login/                  # 로그인
│   ├── maintenance/            # 점검 페이지
│   └── api/                    # API Route Handlers
│       ├── auth/[...nextauth]/ # NextAuth
│       ├── decks/              # 덱 CRUD + 투표/북마크/댓글
│       ├── ego-gifts/          # E.G.O 기프트 조회
│       ├── keyword-meta/       # 키워드 메타 조회
│       ├── search/             # 글로벌 검색
│       ├── collection/         # 컬렉션
│       ├── tier-list/          # 티어 리스트
│       ├── meta/               # 사용 통계
│       └── admin/              # 관리자 API
├── components/                 # 재사용 컴포넌트
│   ├── layout/                 # Navbar (스크롤 숨김), Footer
│   ├── ui/                     # BaseModal, GiftCard, KeywordChip, SearchModal 등
│   ├── sinners/                # SinnerCard, IdentityCard, KeywordTooltip
│   ├── decks/                  # DeckCard, NoteChips
│   ├── random/                 # SlotMachine, SlotReel, OptionPanel
│   ├── admin/                  # AdminButton, AdminTable, AdminToast
│   └── providers/              # SessionProvider, KeywordProvider
├── lib/                        # 공유 라이브러리
│   ├── constants/              # 게임 상수 (STORAGE_BASE, SIN_ICON_MAP 등)
│   ├── utils/                  # 이미지 URL 헬퍼 (images.ts), 공통 유틸
│   └── supabase/               # Supabase 클라이언트 설정
├── scripts/                    # 데이터 동기화 스크립트 (.mjs)
├── public/                     # 정적 에셋 (폰트)
├── proxy.ts                    # 라우트 미들웨어 (점검 리다이렉트, 레이트 리밋)
├── tailwind.config.ts          # Tailwind 설정
└── package.json                # 의존성 정의
```

---

## 데이터 플로우

```
게임 클라이언트 JSON ──→ 동기화 스크립트 ──→ Supabase DB ──→ API Routes ──→ Client Components
        │                     │                   │              │               │
 Json (Text)/*.txt     sync-game-data.mjs    limbus.*      app/api/*     React 19 + SWR
 Json-2/*.json         sync-ego-gifts.mjs    테이블들       Route Handler  Zustand
 kr/*.json             seed-*.mjs                                         nuqs
```

### 1단계: 게임 데이터 추출

게임 클라이언트에서 추출한 JSON 파일이 1차 소스이다.

| 소스 경로 | 내용 | 형식 |
|-----------|------|------|
| `Json (Text)/*.txt` | 인격 스탯, 스킬 수치, 패시브 배정 | JSON (BOM 포함, `.replace(/^\uFEFF/, '')` 필수) |
| `Json-2/*.json` | E.G.O, 가챠, 거울 던전 데이터 | JSON |
| `kr/*.json` | KR 로케일 (이름, 스킬 텍스트, 패시브 텍스트) | JSON |

### 2단계: 동기화 스크립트

```bash
node --env-file=.env.local scripts/sync/game-data.mjs --dry-run   # 프리뷰
node --env-file=.env.local scripts/sync/game-data.mjs --fix        # DB 반영
```

| 스크립트 | 용도 |
|----------|------|
| `sync-game-data.mjs` | 인격/E.G.O 스킬 동기화 (업타이 3/4) |
| `sync-ego-gifts.mjs` | E.G.O 기프트 동기화 |
| `sync-wiki-namu.mjs` | Namuwiki 데이터 동기화 (레거시, 유지보수만) |
| `seed-*.mjs` | 초기 데이터 시딩 (죄수, 키워드 아이콘, 법률 문서) |
| `upload-*.mjs` | 이미지 에셋 → Supabase Storage 업로드 |

### 3단계: Supabase DB

`limbus` 스키마 내 핵심 테이블:

| 테이블 | 설명 |
|--------|------|
| `sinners` | 12명 죄수 기본 정보 |
| `identities` | 인격 (스탯, 저항, 소속, 키워드) |
| `skills` | 인격 스킬 (업타이 3/4 별도 행, `variant_order`로 표시 순서 보장) |
| `passives` | 인격 패시브 (전투/서포터) |
| `ego` | E.G.O |
| `ego_skills` | E.G.O 스킬 (각성/침식, 감정해석 3/4) |
| `keyword_meta` | 키워드 메타 (이름, 설명, 아이콘, 죄 친화도) |
| `ego_gifts` | E.G.O 기프트 (활성화 조건 JSONB) |
| `ego_gift_recipes` | 기프트 합성 레시피 |
| `ego_gift_themes` | 테마팩 (소속/전용 기프트, 보스, 난이도, 층 정보) |
| `decks` | 유저 덱 |
| `deck_identities` | 덱-인격 매핑 |
| `deck_votes` | 덱 투표 |
| `deck_comments` | 덱 댓글 (대댓글 지원) |
| `profiles` | 유저 프로필 |
| `announcements` | 공지사항 |
| `site_maintenance` | 페이지별 점검 상태 |
| `panic_types` | 패닉 유형 |
| `mental_condition_templates` | 정신력 조건 템플릿 |
| `identity_sanity_conditions` | 인격별 정신력 조건 |

### 4단계: API Routes → 클라이언트

API Route Handler가 Supabase에서 데이터를 조회하여 클라이언트 컴포넌트에 전달한다.

---

## 인증

```
브라우저 ──→ /login ──→ NextAuth (Google OAuth) ──→ 세션 생성
                                                      │
                                    SessionProvider (전역 Context)
                                                      │
                              API Routes에서 getServerSession()으로 인증 확인
```

- **NextAuth v4** + Google OAuth Provider
- `SessionProvider`로 클라이언트 세션 관리
- 관리자 API: `getServerSession()` + 관리자 역할 확인
- 감사 로그: 관리자 행동 기록 (`admin/audit-logs`)

---

## 스토리지

**Supabase Storage** — `limbus-assets` 버킷

```
limbus-assets/
├── icons/
│   ├── Rarity/          # 등급 별/프레임 아이콘
│   ├── Sins/            # 7죄 아이콘
│   ├── stats/           # 공격 유형 아이콘 (참격/관통/타격)
│   ├── keywords/        # 키워드 아이콘 (200+)
│   ├── Sinners/         # 죄수 로고 아이콘 (12개)
│   ├── skills/          # 스킬 아이콘 (죄수별 폴더)
│   ├── sd/              # SD 스프라이트
│   └── theme-packs/     # 테마팩 이미지 + 보스 이미지
├── sinners/
│   └── {sinnerId}/
│       ├── identities/  # 인격 일러스트 (normal, gacksung, info, profile)
│       └── ego/         # E.G.O 이미지
└── ego-gifts/           # E.G.O 기프트 이미지
```

이미지 URL은 반드시 `lib/utils/images.ts`의 헬퍼 함수를 사용한다. 하드코딩 금지.

---

## 렌더링 전략

| 전략 | 적용 페이지 | 이유 |
|------|------------|------|
| **Static (SSG)** | `/sinners`, `/privacy`, `/terms` | 데이터 변경 빈도 낮음 |
| **Dynamic (SSR)** | `/decks`, `/mypage`, `/admin/*` | 유저별 데이터, 실시간 반영 |
| **ISR** | `/sinners/[slug]`, `/tier-list` | 데이터 변경 시 재생성 |
| **Client-side** | `/extraction`, `/random`, `/collection` | 클라이언트 전용 인터랙션 |
| **force-dynamic** | `api/ego-gifts` | 항상 최신 데이터 보장 |

---

## 핵심 패턴

### rem 전용 사이징

모든 크기 값은 `rem`으로 지정한다. `px` 사용 금지.

```css
/* 올바름 */
font-size: 0.875rem;
padding: 1rem;

/* 금지 */
font-size: 14px;
padding: 16px;
```

### 다크 테마

기본이자 유일한 테마이다. 밝은 테마는 없다. 모든 컴포넌트는 다크 배경을 전제로 디자인한다.

### GSAP 애니메이션

SSR 환경에서 GSAP를 사용하기 위해 항상 동적 import한다.

```typescript
// 올바름
const gsap = (await import('gsap')).default;

// 금지 (SSR 깨짐)
import gsap from 'gsap';
```

적용 사례:
- 히어로 페이지 진입 애니메이션
- IdentityCard 호버 효과
- SlotReel 회전 애니메이션
- 사용 통계 차트 (`/meta`)

### Zod 유효성 검사

API Route와 동기화 스크립트에서 Zod v4 스키마로 입력 데이터를 검증한다.

### z-index 스태킹

- 그리드/카드 컨테이너: `position: relative; z-index: 0` (스태킹 컨텍스트 격리)
- 모달: `fixed inset-0 z-50`
- 호버 요소: 부모의 스태킹 컨텍스트 내에서만 동작

### 이미지 URL 헬퍼

```typescript
// lib/utils/images.ts
getIdentityImageUrl(sinnerId, folderName, gameId)
getIdentityProfileUrl(identity)
getIdentityInfoUrl(identity)
getEGOImageUrl(sinnerId, folder)
getSkillIconUrl(identity, idx)
getSinnerLogoUrl(sinnerId)
getKeywordIconUrl(keyword)
getSinIconUrl(sin)
```

`STORAGE_BASE`는 `lib/constants/game`에서 import한다. 로컬 재정의 금지.

### 이벤트 전파

클릭 가능한 부모 내부의 버튼(X/제거)은 반드시 `e.stopPropagation()`을 호출한다.

---

## 미들웨어

`proxy.ts`가 Next.js 라우트 미들웨어 역할을 한다 (`middleware.ts` 아님).

- 페이지별 점검 모드 리다이렉트 (`site_maintenance` 테이블 참조)
- 레이트 리밋 (`lib/rate-limit.ts`)

---

## 글로벌 검색

`SearchModal` (Cmd+K / Ctrl+K)이 `api/search`를 호출하여 인격, E.G.O, 죄수, 키워드, E.G.O 기프트를 통합 검색한다.

---

## 컨텍스트 프로바이더

| Provider | 파일 | 역할 |
|----------|------|------|
| `SessionProvider` | `components/providers/SessionProvider.tsx` | NextAuth 세션 전역 관리 |
| `KeywordProvider` | `components/providers/KeywordProvider.tsx` | 키워드 메타 전역 캐시 (KeywordTooltip 등에서 사용) |

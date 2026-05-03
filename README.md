<div align="center">

# 최애의 관리자

**SAIGO NO DANTE**

Limbus Company 팬 아카이브 — 수감자 DB, 덱 빌더, 덱 공유를 한 곳에서.

[saigonodante.com](https://saigonodante.com)

---

`Next.js 16` · `TypeScript` · `Tailwind CSS 4` · `Supabase` · `GSAP`

</div>

## Features

| 기능 | 설명 |
|------|------|
| 수감자 도감 | 12인 수감자 인격 · EGO 데이터베이스 (스킬, 패시브, 스탯) |
| 거울 던전 | EGO 기프트 도감 408종 (키워드/등급 필터, 조합 레시피) |
| 덱 빌더 | 인격 + EGO 기프트 조합, 커뮤니티 공유 · 추천 · 댓글 |
| 보유 현황 | 인격/EGO 체크리스트, URL 공유 |
| 티어 리스트 | 리세마라 티어표 (커뮤니티 투표) |
| 추출 시뮬 | 뽑기 시뮬레이션 |
| 메타 분석 | 인격/EGO 사용 통계 + 차트 |
| 전역 검색 | `Ctrl+K` — 인격, EGO, 수감자, 키워드, EGO 기프트 통합 검색 |
| 관리자 패널 | 데이터 CRUD, 사용자/덱 관리, 감사 로그 |
| PWA | 모바일 홈 화면 설치 지원 |

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + GSAP |
| Database | Supabase (PostgreSQL, `limbus` 스키마) |
| Auth | NextAuth.js (Google OAuth) |
| Icons | Lucide React |
| Testing | Playwright (E2E) |
| Deploy | Vercel |

## Getting Started

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 프로젝트 루트에 생성:

```env
NEXT_PUBLIC_SITE_URL=https://saigonodante.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=              # openssl rand -base64 32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com
```

### 3. Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Settings > API > Extra search path에 `limbus` 추가
4. Auth > Providers에서 Google OAuth 활성화

### 4. 개발 서버

```bash
npm run dev
```

## Scripts

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npx tsc --noEmit     # 타입 체크
```

### 데이터 동기화

```bash
npx tsx scripts/sync/identity-data.ts --dry-run        # 인격/EGO 전체 확인
npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run  # 거던 전체 확인

npx tsx scripts/sync/identity-data.ts --fix            # 승인 후 DB 반영
npx tsx scripts/sync/mirror-dungeon-data.ts --fix      # 승인 후 DB 반영
```

## Project Structure

```
app/
  page.tsx                          # 홈 (GSAP 히어로 + 최신 인격)
  sinners/                          # 수감자 도감
  decks/                            # 덱 게시판 + 빌더
  mirror-dungeon/                   # 거울 던전 EGO 기프트
  collection/                       # 보유 현황
  tier-list/                        # 티어 리스트
  extraction/                       # 추출 시뮬
  meta/                             # 메타 분석
  admin/                            # 관리자 패널
  api/                              # API 라우트

components/
  layout/                           # Navbar, Footer
  sinners/                          # SinnerCard, IdentityCard
  decks/                            # DeckCard
  ui/                               # GlitchText, ConfirmModal, SearchModal 등
  providers/                        # SessionProvider, KeywordProvider

lib/
  supabase/                         # client, server, admin
  types/                            # 타입 정의
  constants/                        # 죄악, 게임, 키워드 상수
  utils/                            # 이미지 URL 헬퍼
```

## Design System

| 요소 | 값 |
|------|-----|
| Background | `#0d0b08` |
| Card | `#1a1510` |
| Gold | `#c8900a` / `#e8b030` / `#8a6010` |
| Fonts | KotraBold · PerfectDOS · SCDream · Pretendard |
| Sin Colors | Tailwind `sin.*` + CSS vars |

## SEO

- 동적 OG 이미지 (1200x630)
- 자동 생성 sitemap + robots.txt
- JSON-LD 구조화 데이터 (WebSite, Organization)
- 페이지별 동적 메타데이터
- Skip Navigation + ARIA 접근성

## License

이 프로젝트는 팬 프로젝트이며 Project Moon과 공식적으로 관련이 없습니다.
Limbus Company 및 관련 에셋은 Project Moon의 지적재산입니다.

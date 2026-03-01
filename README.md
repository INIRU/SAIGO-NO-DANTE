# 최애의 관리자 (SAIGO NO DANTE)

Limbus Company 팬 아카이브 — 수감자 DB, 덱 빌더, 덱 공유를 한 곳에서.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + GSAP (애니메이션)
- **Database**: Supabase (PostgreSQL, `limbus` 스키마)
- **Auth**: NextAuth.js (Google OAuth)
- **Icons**: Lucide React
- **Fonts**: KotraBold, PerfectDOS, SCDream, Pretendard (로컬)

## Getting Started

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 프로젝트 루트에 생성:

```env
# Site URL (SEO: canonical, sitemap, OG image)
NEXT_PUBLIC_SITE_URL=https://saigonodante.com

# YouTube (Project Moon 공식 채널)
YOUTUBE_CHANNEL_ID=UCpqyr6h4RCXCEswHlkSjykA

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=           # openssl rand -base64 32

# Google OAuth (Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# 관리자 이메일 (콤마 구분)
ADMIN_EMAILS=admin@example.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # 시드 스크립트 전용
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

[http://localhost:3000](http://localhost:3000)에서 확인.

## Scripts

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npx tsc --noEmit     # 타입 체크
```

### 시드 스크립트

게임 데이터를 DB에 동기화합니다. `SUPABASE_SERVICE_ROLE_KEY` 필요.

```bash
node --env-file=.env.local scripts/{name}.mjs
```

| 스크립트 | 설명 |
|----------|------|
| `seed-sinners.mjs` | 12 수감자 기본 데이터 |
| `seed-yi-sang.mjs` | 이상 인격 + EGO |
| `seed-passives.mjs` | 패시브 데이터 (단빵숲 API) |
| `sync-ego-from-baslimbus.mjs` | EGO 동기화 |
| `sync-ego-skills-from-baslimbus.mjs` | EGO 스킬 동기화 |
| `upload-assets.mjs` | 이미지 에셋 업로드 |
| `upload-keyword-icons.mjs` | 키워드 아이콘 업로드 |

## Project Structure

```
app/
  page.tsx                          # 홈 (GSAP 히어로 + 최신 인격)
  sinners/page.tsx                  # 12 수감자 그리드
  sinners/[slug]/                   # 수감자 상세 (인격 + EGO)
  sinners/[slug]/identities/[id]/   # 인격 상세 (스킬, 패시브, 스탯)
  sinners/[slug]/ego/[egoId]/       # EGO 상세
  decks/page.tsx                    # 덱 게시판
  decks/new/                        # 덱 빌더
  decks/[id]/                       # 덱 상세
  collection/page.tsx               # 내 수집 현황
  admin/                            # 관리자 (대시보드, 유저, 덱, 데이터, 감사로그)
  api/                              # API 라우트
  opengraph-image.tsx               # 동적 OG 이미지
  sitemap.ts                        # sitemap.xml
  robots.ts                         # robots.txt
components/
  layout/                           # Navbar, Footer
  sinners/                          # SinnerCard, IdentityCard
  decks/                            # DeckCard
  ui/                               # GlitchText, ConfirmModal, SinBadge 등
lib/
  supabase/                         # client.ts, server.ts, admin.ts
  data/sinners.ts                   # 타입 + 데이터 헬퍼
  auth.ts                           # NextAuth 설정
```

## Design System

| 요소 | 값 |
|------|-----|
| 배경 | `#0d0b08` (warm dark brown) |
| 카드 | `#1a1510` |
| 골드 | `#c8900a` / light `#e8b030` / dim `#8a6010` |
| 7대 죄악 | Tailwind `sin.*` + CSS vars |

## Data Source

게임 데이터는 [단빵숲 (baslimbus)](https://baslimbus.store) 팬 위키 API에서 수집합니다.

```
GET https://baslimbus.store/dictionary/identity/{id}
```

## SEO

- `app/opengraph-image.tsx` — 동적 OG 이미지 (1200x630)
- `app/sitemap.ts` — 자동 생성 sitemap
- `app/robots.ts` — 크롤링 규칙 (`/admin/`, `/api/`, `/mypage` 차단)
- `app/icon.png` + `app/apple-icon.png` — favicon
- 수감자 상세 페이지별 동적 메타데이터 (`generateMetadata`)

## Deploy

Vercel 권장. 환경변수를 Vercel 대시보드에 설정하세요.

```bash
vercel --prod
```

`NEXT_PUBLIC_SITE_URL`을 배포 도메인으로 변경하는 것을 잊지 마세요.

## License

이 프로젝트는 팬 프로젝트이며 Project Moon과 공식적으로 관련이 없습니다.
Limbus Company 및 관련 에셋은 Project Moon의 지적재산입니다.

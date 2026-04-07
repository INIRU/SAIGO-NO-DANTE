# SAIGO NO DANTE (最期のDANTE)

> Limbus Company 데이터 아카이브 + 거울 던전 플래너

**GitHub**: [INIRU/SAIGO-NO-DANTE](https://github.com/INIRU/SAIGO-NO-DANTE)

---

## 프로젝트 개요

SAIGO NO DANTE는 모바일 게임 **림버스 컴퍼니**의 데이터를 한 곳에서 조회하고, 거울 던전 전략을 세울 수 있는 웹 애플리케이션이다. 죄수/인격/E.G.O 정보 열람, E.G.O 기프트 백과사전, 거울 던전 플래너, 덱 빌더, 뽑기 시뮬레이터, 랜덤 편성 등 다양한 기능을 제공한다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router, React 19) |
| 데이터베이스 | Supabase (PostgreSQL, `limbus` 스키마) |
| 인증 | NextAuth v4 + Google OAuth |
| 스타일링 | Tailwind CSS v4 |
| 애니메이션 | GSAP, Framer Motion |
| 상태 관리 | Zustand, SWR, nuqs |
| 유효성 검사 | Zod v4 |
| 3D | Three.js |
| 배포 | Vercel |
| 모니터링 | Sentry, Vercel Analytics |
| 테스트 | Vitest, Playwright |

## 문서 인덱스

### 프로젝트 문서

| 문서 | 설명 |
|------|------|
| [README.md](./README.md) | 프로젝트 개요 및 문서 인덱스 (현재 문서) |
| [prd.md](./prd.md) | 제품 요구사항 정의서 (PRD) |
| [architecture.md](./architecture.md) | 기술 아키텍처 |

### 기능별 문서

| 디렉터리 | 대상 기능 |
|-----------|-----------|
| [01-sinners/](./01-sinners/) | 죄수/인격/E.G.O 데이터 조회 |
| [02-mirror-dungeon/](./02-mirror-dungeon/) | 거울 던전 E.G.O 기프트 백과사전 |
| [03-planner/](./03-planner/) | 거울 던전 플래너 |
| [04-decks/](./04-decks/) | 덱 빌더 및 커뮤니티 공유 |
| [05-keywords/](./05-keywords/) | 키워드 사전 |
| [06-tier-list/](./06-tier-list/) | 리롤 티어 리스트 |
| [07-random/](./07-random/) | 랜덤 편성 (슬롯머신) |
| [08-collection/](./08-collection/) | 컬렉션 체크리스트 |
| [09-extraction/](./09-extraction/) | 뽑기 시뮬레이터 |
| [10-story/](./10-story/) | 스토리 뷰어 |
| [11-admin/](./11-admin/) | 관리자 대시보드 |
| [components/](./components/) | 공통 컴포넌트 카탈로그 |

## 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 테스트
npm run test
```

## 환경 변수

`.env.local` 파일에 다음 변수가 필요하다:

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (스크립트용) |
| `NEXTAUTH_SECRET` | NextAuth 시크릿 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 |

## 프로젝트 구조

```
limbus-archive/
├── app/                    # Next.js App Router 페이지 및 API 라우트
│   ├── api/                # API 라우트 핸들러
│   ├── sinners/            # 죄수/인격/E.G.O 페이지
│   ├── mirror-dungeon/     # 거울 던전 백과사전
│   ├── decks/              # 덱 빌더
│   ├── collection/         # 컬렉션 체크리스트
│   ├── tier-list/          # 티어 리스트
│   ├── extraction/         # 뽑기 시뮬레이터
│   ├── random/             # 랜덤 편성
│   ├── admin/              # 관리자 페이지
│   └── globals.css         # 글로벌 스타일
├── components/             # 재사용 가능한 컴포넌트
│   ├── layout/             # Navbar, Footer
│   ├── ui/                 # BaseModal, GiftCard, KeywordChip 등
│   ├── sinners/            # 죄수 관련 컴포넌트
│   ├── decks/              # 덱 관련 컴포넌트
│   ├── random/             # 랜덤 편성 컴포넌트
│   ├── admin/              # 관리자 UI 컴포넌트
│   └── providers/          # Context Provider (Session, Keyword)
├── lib/                    # 유틸리티, 타입, 상수
│   ├── constants/          # 게임 상수 (STORAGE_BASE 등)
│   ├── utils/              # 이미지 URL 헬퍼, 공통 유틸
│   └── supabase/           # Supabase 클라이언트
├── scripts/                # 데이터 동기화 스크립트 (MJS)
├── public/                 # 정적 에셋 (폰트 등)
├── docs/                   # 프로젝트 문서
└── proxy.ts                # Next.js 라우트 미들웨어
```

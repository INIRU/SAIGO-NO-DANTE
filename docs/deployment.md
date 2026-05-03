# 배포 및 인프라

SAIGO NO DANTE 프로젝트의 배포, 인프라, CI/CD 문서.

---

## 기술 스택

| 구분 | 기술 | 버전/비고 |
|------|------|-----------|
| 프레임워크 | Next.js | 16.x (App Router) |
| 런타임 | React | 19.x |
| 언어 | TypeScript | 6.x |
| 호스팅 | Vercel | 자동 배포 |
| 데이터베이스 | Supabase (PostgreSQL) | `limbus` 커스텀 스키마 |
| 스토리지 | Supabase Storage | `limbus-assets` 버킷 |
| 인증 | NextAuth (v4) | Google OAuth |
| 에러 추적 | Sentry | `@sentry/nextjs` |
| CSS | Tailwind CSS | v4 |
| 상태 관리 | Zustand | 5.x |
| 이미지 처리 | sharp | 서버사이드 WebP 변환 |
| 애니메이션 | GSAP, Framer Motion | |
| AI | AI SDK (`ai`, `@ai-sdk/openai`) | |
| 분석 | Vercel Analytics | `@vercel/analytics` |
| 테스트 | Vitest, Playwright | 단위/E2E |

---

## 플랫폼 구성

### Vercel (호스팅)

- **프로젝트**: Vercel에 연결된 Next.js 앱
- **도메인**: `saigo-no-dante.com`, `saigo-no-dante.vercel.app`
- **빌드 명령어**: `next build`
- **Node.js 버전**: 20.x+
- **프레임워크 프리셋**: Next.js (자동 감지)

### Supabase (데이터베이스 + 스토리지)

- **프로젝트 ID**: `lpgqcleszdlldneiwgep`
- **스키마**: `limbus` (커스텀, `public` 아님)
- **API search_path**: `limbus`가 Extra search path에 추가되어야 함
- **스토리지 버킷**: `limbus-assets` (공개 접근)
- **스토리지 Base URL**: `https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets`

### GitHub

- **리포지토리**: `INIRU/SAIGO-NO-DANTE`
- **기본 브랜치**: `main`
- **접근**: Private

---

## 환경 변수

### 필수 (런타임)

| 변수 | 설명 | 위치 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Vercel + .env.local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 공개 키 | Vercel + .env.local |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (RLS 바이패스) | Vercel + .env.local |
| `NEXTAUTH_SECRET` | NextAuth 암호화 시크릿 | Vercel + .env.local |
| `NEXTAUTH_URL` | NextAuth 콜백 URL (프로덕션: `https://saigo-no-dante.com`) | Vercel + .env.local |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | Vercel + .env.local |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 | Vercel + .env.local |

### 선택 (기능별)

| 변수 | 설명 | 위치 |
|------|------|------|
| `ADMIN_EMAILS` | 관리자 이메일 목록 (콤마 구분) | Vercel + .env.local |
| `SENTRY_ORG` | Sentry 조직명 | Vercel |
| `SENTRY_PROJECT` | Sentry 프로젝트명 | Vercel |
| `SENTRY_AUTH_TOKEN` | Sentry 인증 토큰 (소스맵 업로드) | Vercel |
| `OPENAI_API_KEY` | OpenAI API 키 (AI 요약 기능) | Vercel + .env.local |

### 로컬 개발

`.env.local` 파일에 환경 변수를 설정:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://lpgqcleszdlldneiwgep.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ADMIN_EMAILS=admin@example.com
```

> `.env.local`은 `.gitignore`에 포함되어 있으므로 커밋되지 않는다.

---

## Next.js 설정

`next.config.ts` 주요 설정:

| 설정 | 값 | 설명 |
|------|-----|------|
| `poweredByHeader` | `false` | X-Powered-By 헤더 제거 |
| `serverExternalPackages` | `['sharp']` | sharp를 클라이언트 번들에서 제외 |
| `cacheComponents` | `true` | `"use cache"` 디렉티브 + PPR 활성화 |
| `cacheLife` | 커스텀 프로필 4개 | `page-1m`, `page-5m`, `page-10m`, `page-1h` |
| `optimizePackageImports` | lucide, sonner, motion 등 | 배럴 파일 트리 쉐이킹 |
| `images.remotePatterns` | Supabase Storage, Google 프로필 | 허용 이미지 소스 |
| `images.minimumCacheTTL` | `2592000` (30일) | 게임 에셋은 거의 변경 없음 |
| `images.formats` | `['image/avif', 'image/webp']` | 최적화 포맷 |

### 보안 헤더

모든 경로에 다음 보안 헤더가 적용됨:

- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy` (self, Supabase, Vercel Analytics 허용)

### Sentry 통합

- `@sentry/nextjs`로 래핑
- 소스맵: 프로덕션 + `SENTRY_AUTH_TOKEN` 존재 시에만 업로드
- 터널 라우트: `/monitoring` (CSP 우회)

---

## 미들웨어 (proxy.ts)

Next.js 16에서는 `middleware.ts` 대신 `proxy.ts`를 사용.

### 주요 기능

1. **점검 모드**: `site_maintenance` 테이블에서 활성 점검 경로 확인 → `/maintenance`로 리다이렉트
2. **봇/스캐너 차단**: WordPress, PHP, 민감 파일 경로 접근 차단 (404 반환)
3. **확장자 차단**: `.php`, `.asp`, `.sql` 등 비 Next.js 확장자 차단
4. **CORS**: 허용된 오리진만 API 접근 가능
5. **Rate Limiting**: `lib/rate-limit.ts` 기반 속도 제한
6. **관리자 인증**: `/admin/*` 경로 JWT 토큰 검증

### 제외 경로

점검 모드에서 제외: `/api`, `/admin`, `/maintenance`, `/login`, `/auth`, `/_next`, `/icons`

---

## Git 워크플로우

### 브랜치 전략

```
main ──────────────────────── (프로덕션, 직접 push 금지)
  │
  └─ {worktree 브랜치} ──── (영구, 삭제 금지)
       ├─ feat/xxx → PR → main merge → 삭제
       └─ fix/xxx → PR → main merge → 삭제
```

### 작업 흐름

1. Worktree 브랜치에서 작업 후 커밋
2. PR용 브랜치 생성 (`feat/`, `fix/` 등)
3. Push: `git push -u origin <branch>`
4. PR 생성: `gh pr create`
5. Squash merge: `gh pr merge <num> --squash --delete-branch`
6. Worktree 브랜치로 복귀: `git fetch origin && git rebase origin/main`

### 규칙

- `main`에 직접 commit/push 금지 (PR로만 merge)
- Worktree 브랜치는 절대 삭제하지 않는다
- PR용 브랜치만 merge 후 삭제
- `docs/` 디렉토리는 `.gitignore`에 포함 — 커밋하지 않는다

---

## CI/CD

### 자동 배포

```
git push origin main (또는 PR merge)
       │
       ▼
GitHub Webhook → Vercel
       │
       ▼
Vercel Build
  ├── npm install
  ├── next build
  ├── Sentry 소스맵 업로드 (프로덕션)
  └── Edge/Serverless Functions 배포
       │
       ▼
프로덕션 배포 완료
```

### Preview 배포

- `main`이 아닌 브랜치에 push하면 Vercel이 자동으로 Preview 배포 생성
- PR에 Preview URL이 코멘트로 추가됨
- Preview 환경은 프로덕션과 동일한 환경 변수 사용 (Vercel 설정에 따라)

### 빌드 확인

```bash
# 로컬 빌드 테스트
npm run build

# 타입 체크
npx tsc --noEmit

# 테스트
npm run test
```

---

## 데이터베이스 마이그레이션

### 마이그레이션 파일 위치

`supabase/` 디렉토리에 SQL 파일로 관리:

| 파일 | 설명 |
|------|------|
| `schema.sql` | 기본 스키마 (sinners, identities, skills, ego, profiles, decks 등) |
| `migration-passives.sql` | 패시브 테이블 |
| `migration-ego-skills.sql` | EGO 스킬 테이블 |
| `migration-ego-gifts.sql` | EGO 기프트 + 레시피 테이블 |
| `migration-announcements.sql` | 공지사항 테이블 |
| `migration-affiliation.sql` | 인격 소속 컬럼 + 키워드 메타 테이블 |
| `migration-uptie.sql` | 업타이 단계 컬럼 + 정신력 컬럼 |
| `migration-sanity-fk.sql` | 정신력 정규화 (panic_types, templates, conditions) |
| `migration-reviews.sql` | 인격 리뷰 테이블 |
| `migration-guides.sql` | 인격 가이드 테이블 |
| `migration-deck-egos.sql` | 덱 EGO 편성 테이블 |
| `migration-deck-code.sql` | 덱 편성코드 컬럼 |
| `migration-bio.sql` | 프로필 bio 컬럼 |
| `migration-user-roles.sql` | 유저 역할/정지 관리 |
| `migration-rarity-int.sql` | 등급 TEXT → INT 변환 |
| `migration-keyword-columns.sql` | 키워드 icon_slug + sin_affinity |
| `migration-audit-logs.sql` | 감사 로그 테이블 |
| `migration-i18n.sql` | 다국어 지원 (번역, AI 요약) |
| `migration-security-hardening.sql` | RLS + 권한 강화 |

### 마이그레이션 실행

Supabase Dashboard > SQL Editor에서 직접 실행.
자동화된 마이그레이션 도구 (Supabase CLI)는 사용하지 않음.

> 마이그레이션 파일은 참고용으로 `supabase/` 디렉토리에 보관.
> 모든 DDL 변경은 Supabase Dashboard에서 수동 실행.

---

## 모니터링

| 도구 | 용도 |
|------|------|
| Vercel Analytics | 페이지 조회수, Web Vitals |
| Sentry | 에러 추적, 성능 모니터링 |
| Supabase Dashboard | DB 쿼리 성능, 스토리지 사용량 |

### Sentry 터널

CSP 제한으로 Sentry SDK가 직접 통신할 수 없으므로, `/monitoring` 경로를 터널로 사용:

```typescript
// next.config.ts
tunnelRoute: "/monitoring"
```

---

## 로컬 개발 환경 설정

```bash
# 1. 리포지토리 클론
git clone git@github.com:INIRU/SAIGO-NO-DANTE.git limbus-archive
cd limbus-archive

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local  # 또는 직접 생성
# .env.local 편집하여 실제 키 입력

# 4. 개발 서버 시작
npm run dev

# 5. http://localhost:3000 접속
```

### 개발 서버 포트

- 기본: `3000`
- 대체: `3001` (CORS 허용 목록에 포함)

---

## 트러블슈팅

### 빌드 실패

```bash
# 타입 에러 확인
npx tsc --noEmit 2>&1 | grep -E 'error TS' | head -10

# 의존성 재설치
rm -rf node_modules .next && npm install
```

### 환경 변수 누락

스크립트 실행 시 `SUPABASE_SERVICE_ROLE_KEY` 누락 에러:
```bash
# 동기화 스크립트 — dotenv 내장 (자동 로드)
npx tsx scripts/sync/identity-data.ts --dry-run
npx tsx scripts/sync/mirror-dungeon-data.ts --dry-run
```

### 이미지 최적화 이슈

- `sharp`는 서버에서만 실행됨 (`serverExternalPackages`에 포함)
- Supabase Storage 이미지는 `next/image`의 `remotePatterns`에 등록되어야 함
- 캐시 TTL: 30일 (`minimumCacheTTL: 2592000`)

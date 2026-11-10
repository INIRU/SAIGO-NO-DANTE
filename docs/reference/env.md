# 환경 변수

코드가 읽는 환경 변수의 이름, 용도, 노출 범위, 쓰는 곳이다. 이름 목록의 기준은 [`.env.example`](../../.env.example)이고, 값은 어떤 문서에도 적지 않는다. 로컬은 `.env.local`, 서버는 `~/saigo/env.production`에 넣는 방법은 [배포와 복구](../guides/deployment.md)의 "환경"에 있다.

노출 범위는 두 가지다.

- **서버 전용**: 서버 코드만 읽는다. 브라우저에 가지 않는다. 비밀 값은 모두 여기에 속한다.
- **공개**: 이름이 `NEXT_PUBLIC_`으로 시작한다. 빌드할 때 브라우저용 파일에 박히므로 비밀을 넣지 않는다. 바꾸면 다시 빌드해야 한다.

## 데이터베이스(Supabase)

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 주소 | 공개 | `lib/supabase/client.ts`, `lib/supabase/admin.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저에서 읽기용으로 쓰는 공개 키 | 공개 | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/public.ts` |
| `SUPABASE_SECRET_KEY` | 모든 권한을 가진 관리자 키 | 서버 전용 | `lib/supabase/admin.ts`, 일부 `scripts/` |

관리자 키는 서버에서만 쓴다. 오래된 `ANON_KEY`·`SERVICE_ROLE_KEY` 이름은 앱이 읽지 않는다.

## 로그인

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `NEXTAUTH_URL` | 로그인 라이브러리(NextAuth)가 되돌아올 사이트 주소. 로컬은 `http://localhost:3000` | 서버 전용 | NextAuth가 직접 읽는다(우리 코드에서 읽지 않음) |
| `NEXTAUTH_SECRET` | 로그인 세션을 서명하는 비밀 값. 게스트 글 확인과 방문자 해시의 보조 비밀로도 쓴다 | 서버 전용 | NextAuth가 직접 읽고, 우리 코드는 `lib/request-meta.ts`, `lib/rate-limit.ts`, `app/api/discovery/visit/route.ts`, `features/account/server/guest.ts`에서 읽는다 |
| `GOOGLE_CLIENT_ID` | Google 로그인 앱 식별자 | 서버 전용 | `lib/auth.ts` |
| `GOOGLE_CLIENT_SECRET` | Google 로그인 앱 비밀 값 | 서버 전용 | `lib/auth.ts` |
| `ADMIN_EMAILS` | 관리자로 인정할 이메일 목록(쉼표로 구분) | 서버 전용 | `lib/auth.ts`, `app/api/admin/users/[id]/route.ts`, `features/account/server/developer-access.ts` |

## 사이트

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 사이트의 정식 주소(메타데이터, 공유 미리보기, 사이트맵) | 공개 | `lib/seo/metadata.ts`, `lib/utils/og-image.ts` |
| `NEXT_PUBLIC_DISCORD_URL` | 이용 제한·약관 안내에 보여 줄 Discord 초대 주소 | 공개 | `app/api/legal/status/route.ts`, `app/api/profile/suspension/route.ts` |
| `YOUTUBE_CHANNEL_ID` | 홈의 최신 영상을 가져올 YouTube 채널 | 서버 전용 | `app/[lang]/(home)/page.tsx` |
| `IP_HASH_SECRET` | 방문자 주소를 해시할 때 쓰는 비밀 값(방문 집계, 요청 횟수 제한). 없으면 `NEXTAUTH_SECRET`을 쓴다 | 서버 전용 | `lib/request-meta.ts`, `lib/rate-limit.ts` |
| `REVALIDATION_SECRET` | 동기화와 스크립트가 캐시된 게임 데이터를 비울 때(`POST /api/revalidate`) 보내는 비밀 값. 추출 도구의 값과 같아야 한다 | 서버 전용 | `app/api/revalidate/route.ts` |
| `DISCORD_ANNOUNCEMENT_WEBHOOK_URL` | 한국어 공지가 게시될 때 Discord로 보내는 웹훅 주소. 없으면 전송을 건너뛰고 관리자 화면에 실패를 알린다 | 서버 전용 | `lib/discord/announcement.ts`, `app/[lang]/admin/announcements/page.tsx` |

## 방문 통계(Cloudflare Web Analytics)

둘 다 있어야 읽는다. 없거나 조회가 실패하면 홈의 도구는 코드에 적힌 기본 순서로 보인다. 토큰 권한은 "계정 > 계정 분석(Account Analytics) > 읽기" 하나다.

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `CLOUDFLARE_ANALYTICS_TOKEN` | 최근 7일 페이지 방문 수를 읽는 API 토큰(홈 도구를 방문 순으로 정렬, 1시간에 한 번 읽음) | 서버 전용 | `lib/cloudflare/page-visits.ts` |
| `CLOUDFLARE_ACCOUNT_ID` | 통계를 읽을 Cloudflare 계정 번호(32자리) | 서버 전용 | `lib/cloudflare/page-visits.ts` |

## 자체 서버

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `SELF_HOSTED` | `1`이면 자체 서버용 설정을 켠다(HTTPS 전용 헤더, 독립 실행 빌드, 이미지 주소, 방문자 주소를 프록시 헤더에서 읽기). Vercel은 `VERCEL=1`을 스스로 넣는다 | 서버 전용 | `next.config.ts`, `app/[lang]/layout.tsx`, `lib/request-meta.ts` |
| `ORIGIN_VERIFY_SECRET` | CloudFront가 보내는 `X-Origin-Verify` 값. 이 값이 맞을 때만 `x-viewer-ip`를 방문자 주소로 믿는다 | 서버 전용 | `lib/request-meta.ts` |

## 브라우저 알림(web-push)

세 값이 모두 있어야 알림을 보낸다. 하나라도 없으면 보내지 않고, 마이페이지의 브라우저 알림 줄이 "지원하지 않음"으로 보인다. 키 쌍은 `npx web-push generate-vapid-keys`로 만든다.

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | 알림 구독 확인용 공개 키 | 서버 전용(알림 구독 때 `/api/push/subscribe` 응답으로 브라우저에 전달) | `lib/push/send.ts` |
| `VAPID_PRIVATE_KEY` | 알림에 서명하는 비밀 키 | 서버 전용 | `lib/push/send.ts` |
| `VAPID_SUBJECT` | 알림 보내는 쪽의 연락처(`mailto:` 주소) | 서버 전용 | `lib/push/send.ts` |

## 점검 목록(Vercel Edge Config)

둘 다 있어야 쓴다. 없으면 점검 목록을 Supabase에서 읽는다(현재 자체 서버가 이 경우).

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `EDGE_CONFIG` | Edge Config 연결 문자열 | 서버 전용 | `lib/maintenance.ts`, `lib/maintenance-edge.ts` |
| `VERCEL_API_TOKEN` | 점검 목록을 Edge Config에 올릴 Vercel 접근 토큰 | 서버 전용 | `lib/maintenance-edge.ts`, `app/api/admin/maintenance/route.ts` |
| `VERCEL_TEAM_ID` | 위 토큰의 Vercel 팀 번호 | 서버 전용 | `lib/maintenance-edge.ts` |

## 오류 추적(Sentry, 선택)

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `SENTRY_DSN` | 서버에서 오류를 보낼 주소 | 서버 전용 | `sentry.server.config.ts`, `sentry.edge.config.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | 브라우저에서 오류를 보낼 주소 | 공개 | `instrumentation-client.ts` |
| `SENTRY_ORG`, `SENTRY_PROJECT` | 빌드 때 소스맵을 올릴 조직과 프로젝트 | 서버 전용(빌드) | `next.config.ts` |
| `SENTRY_AUTH_TOKEN` | 소스맵을 올릴 때 쓰는 비밀 토큰 | 서버 전용(빌드) | `next.config.ts` |

## 스크립트 전용

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `SITE_URL` | 예시 파일에 있지만 지금 코드에서 이 이름을 읽는 곳을 찾지 못했다(`lib/seo/metadata.ts`의 `SITE_URL` 상수와 다르다) | 서버 전용 | 없음 |
| `LIMBUS_DATA_DIR` | 게임 원본 JSON 폴더 위치 | 서버 전용(스크립트) | `scripts/data/start-gifts.mjs` |

## 예시 파일에 없는 변수

코드가 읽지만 `.env.example`에는 없는 값이다. 대부분 평소에는 넣지 않는다.

| 이름 | 용도 | 노출 | 쓰는 곳 |
|---|---|---|---|
| `NEXT_PUBLIC_AD_PREVIEW` | `1`이면 개발 중이 아닌 빌드에서도 광고 자리를 미리 그린다 | 공개 | `components/ads/AdSlot.tsx` |
| `NEXT_PUBLIC_PRESCRIPT_MODE` | `1`이면 보류 중인 지침서 모드를 운영에서도 연다(개발에서는 항상 열림) | 공개 | `lib/fun/prescript-flag.ts` |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | 어시스트 오류 보고에 담는 빌드 커밋 | 공개 | `features/assist/hooks/useAssistCapture.ts` |
| `SKIP_BUILD_TYPECHECK` | `1`이면 빌드 중 타입 검사를 건너뛴다. 서버 배포 스크립트가 넣고, 타입 검사는 CI가 맡는다 | 서버 전용(빌드) | `next.config.ts` |
| `VERCEL` | Vercel이 스스로 넣는 값. `1`이면 Vercel 분석과 HTTPS 설정을 켠다 | 서버 전용 | `next.config.ts`, `app/[lang]/layout.tsx` |

## 새 변수를 더할 때

1. 코드에서 읽는다. 브라우저가 읽어야 하면 `NEXT_PUBLIC_` 이름을, 비밀이면 접두사 없는 이름을 쓴다.
2. `.env.example`에 이름을 더하고(값은 비운다), 이 문서의 표에 한 줄을 더한다.
3. 서버에도 `~/saigo/env.production`에 넣고 `sudo systemctl restart saigo-web`으로 다시 켠다. `NEXT_PUBLIC_*`는 다시 배포해야 한다.

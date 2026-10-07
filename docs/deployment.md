# 배포와 복구

현재 코드의 호스팅 설정은 Vercel, DB/Storage는 Supabase, 인증은 NextAuth Google OAuth다. 저장소가 있다고 서비스가 운영 중인 것은 아니다. 배포·도메인·DB 활성 상태를 각각 확인한다.

Vercel은 `main` 브랜치만 자동 배포한다(`vercel.json`의 `git.deploymentEnabled`). 패턴은 minimatch라 `*`는 `feat/...`처럼 `/`가 있는 브랜치를 막지 못해 `**`를 쓴다. PR 브랜치에는 미리보기 배포를 만들지 않으며, PR의 빌드·타입 검사는 GitHub Actions(`ci.yml`)가 맡는다. 화면 확인이 필요한 브랜치는 로컬 `npm run dev`나 `vercel deploy`로 따로 올린다.

## 환경

로컬 .env.local과 배포 플랫폼에 현재 코드가 읽는 이름으로 설정한다. 실제 값은 Git에 넣지 않는다.

이름 목록은 [`.env.example`](../.env.example)이 기준이다(Supabase, 로그인, 사이트, Vercel Edge Config, Sentry, 스크립트 전용). 새 환경 변수를 코드에 넣으면 그 파일에 이름을 추가한다. Vercel CLI에 로그인돼 있으면 `npm run env:pull`이 프로젝트 값으로 `.env.local`을 만든다.

`DISCORD_ANNOUNCEMENT_WEBHOOK_URL`은 서버 전용이다. 한국어 공지가 게시되는 순간(새로 게시하거나 임시 저장을 게시로 바꿀 때) 디스코드로 한 번 보낸다. 본문 마크다운을 유지하고 이미지 앞뒤로 메시지를 나눈다. 값이 없으면 전송을 건너뛰고 관리자 화면에 실패를 알린다.

점검(`/admin/maintenance`)은 Supabase `site_maintenance`에 저장한다. `EDGE_CONFIG`(Vercel Storage의 saigo-no-dante-edge-config 연결 문자열)와 `VERCEL_API_TOKEN`(Warin 팀 범위의 Vercel 액세스 토큰)이 모두 있으면 저장할 때마다 활성 점검 목록을 Edge Config `maintenance` 항목에 올리고, proxy도 Edge Config에서 읽는다. 둘 중 하나라도 없으면 proxy는 Supabase를 읽는다. 어느 쪽이든 인스턴스마다 15초 동안 목록을 재사용한다.

일부 동기화 스크립트는 SUPABASE_SERVICE_ROLE_KEY도 받지만 앱의 현재 관리자 클라이언트는 SUPABASE_SECRET_KEY를 읽는다. 오래된 ANON_KEY 예시를 그대로 사용하지 않는다.
선택 설정은 SENTRY_ORG/PROJECT/AUTH_TOKEN, 캐시 무효화용 REVALIDATION_SECRET, 공지 수집용 SITE_URL 등의 실제 호출자를 확인한다.

## 복구 순서

1. 원본의 미커밋 변경·rebase·백업을 보존하고 정상 Git 작업본을 확보한다.
2. npm ci, typecheck, 단위 테스트, production build를 실행한다.
3. Chrome에서 수감자 상세, 스킬/패시브, 운영법, 덱·플래너, 검색과 locale 전환을 확인한다. 제거한 페이지는 더 이상 제공되지 않아야 한다.
4. 운영 DB의 활성 상태, 권한과 실제 데이터, OAuth 콜백, Storage 이미지, 도메인·배포 환경을 확인한다.
5. 승인된 배포 범위에서 배포하고 외부 도메인에서 다시 검증한다. 유지보수 해제와 DB 쓰기는 각각 실제 변경 내역을 확인한다.

## Git과 롤백

기능별 작은 커밋을 유지한다. main에는 PR로 반영한다. 되돌릴 때 git log --oneline으로 커밋을 찾고 의존하는 후속 변경부터 git revert한다. DB를 건드리지 않은 기능 삭제 커밋은 Git으로 코드 복구가 가능하다.

이번 복구 작업본은 limbus-archive-restored다. 기존 limbus-archive는 중단된 rebase와 iCloud 파일을 보존하기 위해 그대로 두었다. 기준 원격 커밋은 e613824다. 기존 폴더를 삭제하기 전 별도의 미커밋/비추적 자료 확인이 필요하다.

2026-09-10 게임 DB와 Storage 복구를 실행하고 읽기 검증했다. 건수·출처·백업·미확정 에셋은 [출처와 복구 기록](https://github.com/INIRU/limbus-asset-extractor/blob/main/site-sync/docs/provenance.md)에 기록했다. 삭제 기능 보관과 EGO 스킬 정규화 마이그레이션도 적용했다. 원격 push와 배포는 수행하지 않았다. 로컬 터널은 임시 미리보기이며 운영 배포나 OAuth 검증을 의미하지 않는다.

2026-09-12 AI 요약 기능을 제거하고 전용 `limbus-ollama` 컨테이너를 중지(자동 재시작 없음)했다. 전용 Nginx/Traefik 경로는 비활성화했으며 설정 백업은 `/opt/limbus-ai/disabled`, 모델 볼륨은 보존했다. Minecraft 서버는 중지 상태를 유지한다.

## 약관 원문 복구

`node scripts/restore-legal-docs.mjs`로 누락된 한국어 문서를 확인하고, `--apply`를 붙여 등록한다. `backups/2026-03-23/legal_docs.json`의 2026년 2월 28일자 원문과 날짜를 그대로 복구하며, 이미 등록된 문서와 동의 기록은 덮어쓰지 않는다. 연결 환경의 `NEXT_PUBLIC_SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 사용한다. 복구 후 `/ko/terms`, `/ko/privacy` 및 번역 경로의 페이지 캐시를 무효화한다. 원문 복구는 현재 기능에 맞춘 약관 개정과 별개다.

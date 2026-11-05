# 배포와 복구

2026-10-19부터 사이트는 AWS Lightsail 서울 서버(`saigo-web`, 2코어·4GB, Ubuntu 24.04)에서 `next start`로 돈다. 방문자는 Cloudflare를 거쳐 Cloudflare Tunnel로 서버에 닿는다. DB/Storage는 Supabase, 인증은 NextAuth Google OAuth다. Vercel 프로젝트는 일시 정지 상태로 남아 있다(되돌릴 때만 쓴다). 저장소가 있다고 서비스가 운영 중인 것은 아니다. 서버·도메인·DB 상태를 각각 확인한다.

## 구성

| 부분 | 위치 |
|---|---|
| 서버 접속 | `ssh -i ~/.ssh/saigo-web ubuntu@54.116.88.118` (비밀키는 사용자 Mac에만 있다) |
| 앱 | `~/saigo/app` (`REVISION`에 배포된 커밋), systemd `saigo-web`이 `127.0.0.1:3000`에서 실행하고 죽으면 다시 켠다 |
| 환경 변수 | `~/saigo/env.production`(권한 600). 앱의 `.env.production.local`이 이 파일을 가리킨다 |
| 터널 | systemd `cloudflared`, 설정 `/etc/cloudflared/config.yml`(터널 `saigo-web`, 호스트 `saigo-no-dante.com`·`www`·`new`) |
| DNS | Cloudflare. apex·`www`는 `d3ra6rwderl7mq.cloudfront.net`을 가리키는 CNAME(DNS 전용, TTL 60), `new`는 터널 프록시 CNAME이다 |
| 열린 포트 | Lightsail 방화벽과 ufw 모두 22번(SSH)만. 웹 포트는 열지 않는다(터널이 서버에서 바깥으로 연결한다) |

apex·`www`의 앞단 구성은 아래 CloudFront 서울 거점 절을 본다. Cloudflare 거점(LAX 등)을 거치는 것은 `media.`·`assets.`뿐이다.

## CloudFront 서울 거점(2026-11-05)

Cloudflare 무료 요금제는 한국 방문자를 LAX로 보내 페이지 하나에 3~8초가 걸렸다. AWS 서울에서는 Cloudflare가 ICN으로 붙어서, 앞에 CloudFront를 둔다: 방문자 → CloudFront(ICN) → Cloudflare(ICN, `origin.saigo-no-dante.com`) → 터널 → 서버. 서버 포트는 그대로 닫혀 있고 Cloudflare 방어도 원본 앞에 남는다.

| 부분 | 값 |
|---|---|
| 배포 | `EQGC66ZU23RAB` (`d3ra6rwderl7mq.cloudfront.net`), 별칭 apex·`www`, 인증서 ACM us-east-1 |
| 원본 | `origin.saigo-no-dante.com`(Cloudflare 프록시 CNAME → 터널). 터널 설정이 이 호스트의 `Host`를 `saigo-no-dante.com`으로 바꾼다(`originRequest.httpHostHeader`) |
| 캐시 | `/_next/static/*`만 CloudFront가 캐시(CachingOptimized). 나머지는 캐시하지 않고 모든 헤더·쿠키·쿼리를 넘긴다(Host 제외) |
| 함수 | `saigo-viewer-ip`(viewer-request): `www` → apex 301, 방문자 IP를 `x-viewer-ip`로 덮어쓴다 |
| 비밀 헤더 | CloudFront가 원본 요청에 `X-Origin-Verify`를 붙인다. 서버 `ORIGIN_VERIFY_SECRET`과 같을 때만 `x-viewer-ip`를 방문자로 믿는다(`lib/request-meta.ts`) |
| 분석 | Cloudflare 프록시가 넣던 Web Analytics 비컨을 레이아웃이 직접 넣는다. 전환 뒤 Cloudflare의 자동 삽입은 끈다 |
| 이미지 | 최적화 이미지(`/_next/image`)는 `media.saigo-no-dante.com`(Cloudflare 프록시 → 터널)에서 받는다. CloudFront 요청 요금의 절반을 넘던 몫이라 빼서, 하루 1,300명 기준 CloudFront 요청이 무료 한도(월 1천만 건) 안이다. 터널은 media 주소에서 `/_next/image`만 서버로 보내고 나머지는 404 |

2026-11-05에 운영을 전환했다. apex·`www`는 `d3ra6rwderl7mq.cloudfront.net` CNAME(DNS 전용, TTL 60)이고, 측정값은 `x-amz-cf-pop: ICN80`, `/ko` 0.14~0.23초다. 되돌리기는 두 기록을 터널 CNAME(`5d996eb4-a451-4d35-a31c-0814b44c01b3.cfargotunnel.com`, 프록시)으로 돌리는 것이다.

## 배포

`main`이 움직이면 GitHub이 빌드하고 서버는 받아서 바꿔 끼운다(2026-10-22부터). 서버 스크립트의 원본은 저장소 `deploy/server/`이고, 고치면 서버의 `~/saigo/`(덧붙임은 `/etc/systemd/system/saigo-web.service.d/`)에 복사한다.

1. GitHub Actions `deploy-build.yml`이 main의 커밋마다 운영용으로 빌드한다(타입 검사 포함, `SELF_HOSTED=1`). `output: 'standalone'`에 `.next/static`·`public`을 넣어 `site-<sha>`(`site.tgz`)로 1일 보관한다. 배포 사이트가 Storage에서 읽는 인식 모델 데이터는 넣지 않는다. 빌드에 쓰는 값은 GitHub 비밀값(Supabase 3개, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SITE_URL`, `YOUTUBE_CHANNEL_ID`, `SENTRY_ORG`, `SENTRY_PROJECT`)이고, 운영 서버 값과 같아야 한다.
2. 서버의 `saigo-deploy.timer`가 2분마다 `auto-deploy.sh`를 돌려 `~/saigo/src`(읽기 전용 배포 키로 받은 main)를 확인하고, 새 커밋이면 `fetch-build.sh`로 그 커밋의 결과물을 받는다(토큰 `~/saigo/github-token`, 이 저장소 Actions 읽기 전용). GitHub 빌드가 진행 중이면 다음 확인까지 기다리고, 실패했으면 배포하지 않는다.
3. 결과물을 받았으면 `deploy.sh`가 `~/saigo/app-new`에 풀고 앱 폴더를 바꿔 끼운 뒤 서비스를 다시 켠다(멈춤은 1초 안팎, 서버는 빌드도 설치도 하지 않는다). 60초 안에 `/ko`가 응답하지 않으면 이전 폴더(`app-old`)로 되돌린다. 실패한 커밋은 `~/saigo/failed-rev`에 남고, main이 다시 움직일 때까지 재시도하지 않는다.
4. 토큰이 없거나 20분이 지나도 GitHub 결과물이 없으면 예전처럼 서버에서 빌드한다(같은 standalone 모양, 타입 검사는 건너뜀: `SKIP_BUILD_TYPECHECK=1`, `nice -n 10`). 2026-10-22 서버 빌드 중 TypeScript 7의 tsc(약 1.75GB)가 빌드·운영 앱과 함께 돌다 메모리가 바닥나 사이트가 몇 분 멈췄다. 그래서 빌드는 GitHub에서 한다.

서비스는 덧붙임 `standalone.conf`로 앱 폴더에 `server.js`가 있으면 `node server.js`, 없으면(되돌린 예전 폴더) `next start`로 뜬다. 환경 변수 파일(`~/saigo/env.production`)은 systemd도 넘긴다.

이미지 최적화 캐시는 배포와 상관없이 `~/saigo/cache/images` 하나를 쓴다. `deploy.sh`가 새 빌드의 `.next/cache/images`를 그 폴더로 잇는다(2026-10-22). 앱 폴더 안에 두면 배포마다 캐시가 사라져 이미지 수천 장을 sharp로 다시 변환하고, 그동안 힙 바깥 메모리가 분당 수 MB씩 늘었다.

서비스 설정은 `/etc/systemd/system/saigo-web.service`와 덧붙임 `saigo-web.service.d/memory.conf`·`standalone.conf`다. 덧붙임은 `MALLOC_ARENA_MAX=2`(sharp가 쓰는 glibc 메모리 영역 수를 줄여 메모리가 불어나지 않게)와 `NODE_OPTIONS=--max-old-space-size=2048 --trace-warnings`(`MaxListenersExceededWarning`이 어디서 나는지 기록)를 넣는다. JS 메모리 상한은 2GB다: 서버에서 빌드하던 때의 1GB에서는 상세 페이지 캐시가 차며 상한에 닿아 서비스가 죽고 재시작 동안 500이 났다(2026-10-23, 빌드는 GitHub로 옮겨 여유가 생김). 서비스는 메모리 상한으로 자동 재시작하지 않는다(사용자 결정, 2026-10-22). 설정은 다음 배포 때 서비스가 새로 뜨면서 적용된다.

- 배포 기록: `journalctl -u saigo-deploy`
- 앱 로그: `journalctl -u saigo-web`
- 지금 배포된 커밋: `cat ~/saigo/app/REVISION`

PR 브랜치는 배포하지 않는다. PR의 빌드·타입 검사는 GitHub Actions(`ci.yml`)가 맡는다. 화면 확인이 필요한 브랜치는 로컬 `npm run dev`로 본다. 특정 커밋을 손으로 올릴 때는 Mac의 작업본에서 실행한다.

```bash
git archive --format=tar.gz <커밋> | ssh -i ~/.ssh/saigo-web ubuntu@54.116.88.118 "bash ~/saigo/deploy.sh $(git rev-parse <커밋>)"
```

## 되돌리기

- 직전 배포로: 앱 폴더를 서로 바꾼다. `sudo systemctl stop saigo-web && mv ~/saigo/app ~/saigo/app-bad && mv ~/saigo/app-old ~/saigo/app && sudo systemctl start saigo-web`. 그다음 원인 커밋을 `git revert`해 main에 올린다. 그대로 두면 타이머가 main을 다시 배포한다.
- Vercel로 운영 되돌리기(서버를 못 쓸 때): Vercel 프로젝트의 일시 정지를 풀고, Cloudflare DNS에서 apex·`www` 터널 CNAME을 지운 뒤 Vercel 프로젝트의 도메인 설정이 알려 주는 A 레코드를 DNS 전용(회색 구름)으로 넣는다. 2026-10-19 기준 값은 apex `216.150.1.193`·`216.150.16.129`, `www` `216.150.1.193`·`216.150.16.193`이다.

## 집 IP가 바뀌어 서버에 접속이 안 될 때

Lightsail 방화벽은 SSH(22번)를 사용자 집 IP 하나에서만 받는다. 인터넷 회선을 바꾸거나 공유기가 새 IP를 받으면 `ssh`가 시간 초과로 끝난다. 사이트는 영향을 받지 않는다(터널은 서버에서 바깥으로 연결한다).

1. 지금 IP를 확인한다: `curl -s https://checkip.amazonaws.com`
2. AWS 콘솔 → Lightsail → 인스턴스 `saigo-web` → 네트워킹 → IPv4 방화벽에서 SSH 규칙을 편집해, "IP 주소로 제한"의 값을 새 IP로 바꾸고 저장한다. 예전 IP는 지운다.
3. 콘솔 대신 AWS CLI로도 된다: Lightsail `PutInstancePublicPorts`로 22번 규칙의 출처 IP를 바꾼다.

밖에서 급히 들어가야 하면 같은 규칙을 그때의 IP로 잠시 바꾸고, 끝나면 집 IP로 돌려놓는다. SSH를 모든 IP(0.0.0.0/0)에 열지 않는다.

## Cloudflare 설정

- 이메일 주소 난독화: 끈다. 켜 두면 푸터의 문의 이메일을 바꿔 써서 React 하이드레이션 오류(#418)가 난다.
- 캐시 규칙 `next-image`: `/_next/image`를 캐시 대상으로 둔다. 원본의 `Cache-Control`(30일)을 따른다. HTML은 캐시하지 않는다(`cf-cache-status: DYNAMIC`). 재검증해도 Cloudflare 캐시는 지워지지 않기 때문이다.
- Web Analytics: 자동 설정으로 켰다. 비컨은 브라우저 사용자 에이전트에만 붙으므로 curl 기본 UA로 받은 HTML에는 없다. CSP는 `next.config.ts`가 허용한다.
- 새 DNS 기록이 반영되지 않으면 먼저 https://www.cloudflarestatus.com 에서 DNS 장애가 있는지 본다(2026-10-19에 약 30분 지연이 있었다).

## 검색 로봇이 받는 HTML

Next.js는 로봇 요청에 메타데이터를 본문으로 흘려보내지 않는다. 그래서 셸을 먼저 보내는 배포(예전 Vercel)에서 셸을 건너뛰지 않는 로봇은 요청마다 메타데이터를 만드는 페이지(덱·인격·E.G.O·플랜 상세)에서 제목·canonical·robots가 없는 HTML을 받았다. 셸을 건너뛰는 로봇 목록은 `next.config.ts`의 `htmlLimitedBots`(`lib/seo/html-limited-bots.ts`: Next.js 기본 목록에 Googlebot과 Daum을 더한 값)다. 이 설정은 기본 목록을 대체하므로 기본 목록을 빼지 않는다.

확인은 `curl -A '<로봇 사용자 에이전트>' <주소>`로 받은 HTML의 `<head>`에 `<title>`과 `rel="canonical"`이 있는지 본다. Search Console의 실시간 테스트(Google-InspectionTool)는 Next.js 기본 목록에 들어 있어 항상 head에 담긴 HTML을 받으므로, Googlebot이 받는 HTML과 다를 수 있다. 2026-10-19 서버 전환 때 Googlebot UA로 인격·E.G.O·덱 상세의 head 제목과 설명을 확인했다.

## 환경

로컬 `.env.local`과 서버 `~/saigo/env.production`에 현재 코드가 읽는 이름으로 설정한다. 실제 값은 Git에 넣지 않는다.

이름 목록은 [`.env.example`](../.env.example)이 기준이다(Supabase, 로그인, 사이트, 자체 서버, Sentry, 스크립트 전용). 새 환경 변수를 코드에 넣으면 그 파일에 이름을 추가하고, 서버 파일에도 넣은 뒤 `sudo systemctl restart saigo-web`으로 다시 켠다. `NEXT_PUBLIC_*` 값은 빌드에 박히므로 바꾸면 다시 배포해야 한다(같은 커밋이면 `~/saigo/app/REVISION`을 지우면 타이머가 다시 빌드한다).

- 서버 전용 값: `SELF_HOSTED=1`(CSP `upgrade-insecure-requests`, 방문자 IP를 `CF-Connecting-IP`에서 읽기), `NEXTAUTH_URL=https://saigo-no-dante.com`.
- 서버에 넣지 않는 값: `EDGE_CONFIG`, `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`. 없으면 점검 목록을 Supabase에서 읽는다.
- Vercel의 값은 대부분 sensitive라 다시 꺼낼 수 없다. `npm run env:pull`(Vercel CLI)로 받아도 그 값은 비어 있다. 서버 값은 사용자 Mac의 `.env.local`에서 코드가 쓰는 이름만 옮겼다.

`VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`는 브라우저 푸시 키다(2026-10-25 서버에서 만들어 서버와 사용자 Mac `.env.local`에 같은 값을 넣음, 서버 백업 `~/saigo/env.production.bak-20261025`). 셋 중 하나라도 없으면 푸시를 보내지 않고 마이페이지의 브라우저 알림 줄이 "지원하지 않음"으로 보인다. 키를 바꾸면 이미 구독한 브라우저는 다시 켜야 한다.

`DISCORD_ANNOUNCEMENT_WEBHOOK_URL`은 서버 전용이다. 한국어 공지가 게시되는 순간(새로 게시하거나 임시 저장을 게시로 바꿀 때) 디스코드로 한 번 보낸다. 본문 마크다운을 유지하고 이미지 앞뒤로 메시지를 나눈다. 값이 없으면 전송을 건너뛰고 관리자 화면에 실패를 알린다.

점검(`/admin/maintenance`)은 Supabase `site_maintenance`에 저장한다. `EDGE_CONFIG`(Vercel Storage의 saigo-no-dante-edge-config 연결 문자열)와 `VERCEL_API_TOKEN`(Warin 팀 범위의 Vercel 액세스 토큰)이 모두 있으면 저장할 때마다 활성 점검 목록을 Edge Config `maintenance` 항목에 올리고, proxy도 Edge Config에서 읽는다. 둘 중 하나라도 없으면(지금 서버) proxy는 Supabase를 읽는다. 어느 쪽이든 인스턴스마다 60초 동안 목록을 재사용한다.

일부 동기화 스크립트는 SUPABASE_SERVICE_ROLE_KEY도 받지만 앱의 현재 관리자 클라이언트는 SUPABASE_SECRET_KEY를 읽는다. 오래된 ANON_KEY 예시를 그대로 사용하지 않는다.
선택 설정은 SENTRY_ORG/PROJECT/AUTH_TOKEN, 캐시 무효화용 REVALIDATION_SECRET(추출 도구의 `tools/site-sync/.env.local`과 같아야 한다), 공지 수집용 SITE_URL 등의 실제 호출자를 확인한다.

## 요금 알림

AWS 예산 `saigo-monthly`가 이번 달 실제 요금이 10달러를 넘을 때마다(10, 20, …, 100달러) 메일을 보낸다. 같은 알림이 SNS `saigo-budget-alerts`(us-east-1)와 Lambda `saigo-budget-discord`를 거쳐 디스코드로도 간다. 웹훅 주소는 Lambda 환경 변수 `DISCORD_WEBHOOK_URL`에 콘솔에서 직접 넣는다. 서버는 월 24달러 고정이고 전송량 4TB가 포함된다.

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

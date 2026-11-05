<div align="center">

# 최애의 관리자 · SAIGO NO DANTE

**림버스 컴퍼니 팬 데이터베이스 · 덱 빌더 · 거울 던전 플래너**

[saigo-no-dante.com](https://saigo-no-dante.com) · 한국어 / English / 日本語

![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)

</div>

---

## 무엇을 하는 사이트인가

| 영역 | 내용 |
|---|---|
| **도감** | 수감자·인격·E.G.O, 스킬과 패시브(동기화 단계별), 키워드, 스킬 모션 |
| **거울 던전** | E.G.O 기프트·조합식·테마팩·이벤트, 기프트 체크 모드 |
| **덱 · 플래너** | 덱 작성과 공유, 거울 던전 공략 플랜, 노트 편집기, 추천과 분석 |
| **커뮤니티** | 덱·플랜 게시판, 시리즈, 친구 코드, 공개 프로필, 댓글 알림 |
| **도구** | 메타 분석, 보유 현황, 랜덤 편성, 피해량·경험치·광기 계산기, 어시스트 모드(화면 인식) |
| **운영** | 공지(팝업·Discord), 문의, 관리자 화면, 개발자 API(`/api/v1`) |

## 기술 스택

- **프레임워크**: Next.js 16 App Router(Cache Components·PPR), React 19, TypeScript
- **데이터**: Supabase(Postgres `limbus` 스키마, Storage), SWR, Zustand
- **UI**: Tailwind CSS 4, Motion, Radix Dialog, next-intl(ko/en/ja)
- **인증**: NextAuth(Google)
- **테스트**: Vitest, Playwright
- **운영**: AWS Lightsail 서울 + Cloudflare Tunnel, GitHub Actions 빌드 배포, Sentry

## 빠르게 시작하기

```bash
npm ci
cp .env.example .env.local   # 값 채우기: docs/deployment.md의 "환경"
npm run dev                  # http://localhost:3000
```

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 단위 테스트(Vitest) |
| `npm run typecheck` | 타입 검사 |
| `npm run build` | 배포용 빌드(어시스트 워커 포함) |
| `npx playwright test` | E2E(배포용 빌드를 `next start`로 띄운 뒤) |
| `npm run audit:data` | 게임 데이터 무결성 검사 |

## 폴더 구조

```text
app/[lang]/        공개 페이지(ko/en/ja): 조회와 화면 조합
app/api/           API 라우트: 요청·인증·입력 검증
components/        기능별 UI (components/ui/ 는 공용 부품)
lib/               도메인 계산, DB 조회(db·supabase), 번역(i18n)
hooks/             브라우저 상태와 생명주기
messages/          ko·en·ja 번역
styles/            전역·컴포넌트 CSS
public/            게임 에셋·글꼴·아이콘·서비스 워커
supabase/          스키마 마이그레이션과 되돌리기 SQL
scripts/           에셋 추출, 데이터, 추천·어시스트 평가, maintenance/(일회성 복구·이전)
tests/  e2e/       Vitest 단위 테스트, Playwright E2E
docs/              개발 문서
deploy/server/     서버 배포 스크립트
```


## 문서

| 문서 | 내용 |
|---|---|
| [개발 문서 목차](docs/README.md) | 작업 종류별로 먼저 읽을 문서 |
| [디자인 기준](DESIGN.md) | 색, 글꼴, 게임 에셋, 공용 컴포넌트, 움직임 |
| [개발과 검증](docs/development.md) | 실행, 테스트, 캐시, 서비스 워커 |
| [데이터 모델](docs/data-model.md) | 표와 칸, 권한, 스키마 변경 기록 |
| [배포와 복구](docs/deployment.md) | 서버·터널, 자동 배포, 되돌리기, 환경 변수 |
| [개발자 API](docs/partner-api.md) | `/api/v1` 자원, 한도, 파트너 연동 |
| [어시스트 화면 인식](docs/assist.md) | 인식 방법, 평가 도구, 측정 기록 |

게임 데이터를 DB·Storage에 반영하는 동기화 코드는 추출 도구 저장소([limbus-asset-extractor](https://github.com/INIRU/limbus-asset-extractor))의 `site-sync/`에 있습니다.

## 알아 두기

- 원본 게임 자료와 운영 DB 백업은 저장소에 두지 않고 따로 보존합니다.
- 로컬에서 실행·빌드가 되는 것과 운영 서비스에 반영된 것은 다릅니다. 반영 여부는 배포 기록으로 확인합니다.
- 비공식 팬 사이트입니다. Limbus Company와 게임 에셋의 저작권은 Project Moon에 있습니다.

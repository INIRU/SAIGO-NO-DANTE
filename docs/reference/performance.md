# 성능 측정

계획 3(결정 0003 4절)의 기준 숫자와 재는 법. 성능 작업마다 아래 "지금" 표를 새 숫자로 고친다. 일회성 보고서는 따로 만들지 않는다.

## 재는 법

개발 서버를 끄고(같이 돌리면 `.next/cache/fetch-cache`가 깨진다) 배포 빌드에서 잰다.

```bash
npm run build && npm run perf:sizes -- --out before.json   # 라우트별 첫 로드 JS·CSS(gzip)
npx next start -p 3320 &                                    # 로컬 배포 서버
npm run perf:lighthouse -- http://localhost:3320 --form mobile   # 화면 8개, --form desktop, --runs 3(중앙값)
```

- 수정 뒤에는 `npm run perf:sizes -- --compare before.json`으로 라우트별 차이를 본다.
- 큰 모듈: `npx next analyze -o`가 `.next/diagnostics/analyze/data/<라우트>/analyze.data`를 쓴다(앞 4바이트가 머리 JSON 길이, 머리의 `chunk_parts`에 모듈별 압축 크기).
- Lighthouse의 JS(KB)는 광고·분석 스크립트와 나중에 불러온 청크까지 포함한 전송량이라 첫 로드 크기보다 크다. 비교는 같은 칸끼리만 한다.

## 화면 8개

| 화면 | 경로 |
|---|---|
| 홈 | `/ko` |
| 덱 게시판 | `/ko/decks` |
| 덱 상세 | `/ko/decks/32fdf886-8dac-4bf2-a817-d53a78fe6425` |
| 플래너 | `/ko/planner` |
| 거울 던전 | `/ko/mirror-dungeon` |
| 인격 상세 | `/ko/sinners/faust/identities/4be6011c-a549-4b29-b434-5f5eaaa43db7` |
| 메타 | `/ko/meta` |
| 보유 현황 | `/ko/collection` |

덱·인격 id는 `scripts/perf/lighthouse.mjs`의 `DECK_ID`·`IDENTITY_ID`와 같다. 글이 지워지면 둘 다 함께 바꾼다.

## 기준 (2026-11-07, `b776135`, 로그아웃, 1회)

| 화면 | 첫 로드 JS | CSS | 휴대폰 점수 | LCP | TBT | CLS | PC 점수 | LCP | CLS |
|---|---|---|---|---|---|---|---|---|---|
| 홈 | 534KB | 73KB | 66 | 10.0s | 188ms | 0.003 | 91 | 1.8s | 0.001 |
| 덱 게시판 | 577KB | 71KB | 55 | 8.1s | 494ms | 0.101 | 88 | 2.0s | 0.054 |
| 덱 상세 | 572KB | 70KB | 56 | 6.9s | 559ms | 0.025 | 63 | 2.2s | 1 |
| 플래너 | 643KB | 70KB | 56 | 15.7s | 280ms | 0 | 89 | 1.9s | 0.023 |
| 거울 던전 | 477KB | 71KB | 58 | 8.7s | 207ms | 0.115 | 93 | 1.4s | 0.069 |
| 인격 상세 | 547KB | 73KB | 35 | 11.8s | 345ms | 1 | 61 | 2.5s | 1 |
| 메타 | 516KB | 79KB | 54 | 9.8s | 251ms | 0.113 | 75 | 4.6s | 0.067 |
| 보유 현황 | 489KB | 70KB | 39 | 10.9s | 267ms | 1 | 68 | 1.8s | 0.761 |

- 내용이 거의 없는 `/[lang]/licenses`도 402KB다. 모든 라우트 공통 227KB + `[lang]` 레이아웃 약 175KB.
- 휴대폰 점수를 가장 많이 깎는 것은 LCP(7~16초)와, 인격 상세·보유 현황·덱 상세(PC)의 화면 밀림(CLS 0.7~1)이다.

## 지금

기준과 같다(아직 줄인 작업 없음).

## 큰 모듈: `[lang]` 레이아웃 묶음

`/[lang]/licenses`의 첫 로드 중 `/_not-found`에 없는 클라이언트 JS, 모듈 압축 크기 합(글꼴 제외) 약 213KB.

| 크기 | 모듈 | 사이트 틀에서 부르는 곳 |
|---|---|---|
| 52KB | `motion-dom`·`framer-motion`·`motion-utils` | `components/ui/MotionProvider.tsx`(레이아웃), `BaseModal`·`ScrollReveal`·`StaggerReveal` |
| 33KB | `zod` | `components/pwa/ServiceWorkerRegister.tsx`가 `lib/push/keys.ts`에서 `PUSH_SCOPE` 상수 하나만 쓰는데 같은 파일의 zod 스키마가 따라 들어온다 |
| 17KB | `lib/i18n/translations.ts` | `lib/i18n/localize.ts`, 내비 검색(`lib/search/pages.ts`) |
| 10KB | `next`(내비 `Link`·라우터 보조) | 레이아웃 전체 |
| 7KB | `@babel/runtime` | 옛 문법 변환을 쓰는 의존성(작업 4 대상) |
| 7KB | `next-auth` | `components/providers/SessionProvider.tsx`, 세션 확인 모달들 |
| 5KB | `swr` | `components/providers/SWRProvider.tsx`, `KeywordProvider.tsx` |
| 5KB | `lucide-react` | 내비·푸터 아이콘 |
| 5KB | `nuqs` | 레이아웃 `NuqsAdapter` |
| 3KB | `components/providers/KeywordProvider.tsx` | 레이아웃 |

- 레이아웃이 받는 글꼴 중 미리 불러오는 것(`.p.`): Pretendard 라틴·한글 1, KOTRA, Bebas. 나머지는 쓰일 때 받는다(작업 9 대상).

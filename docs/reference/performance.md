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

작업 6(큰 화면 나누기) 뒤, 2026-11-07. 첫 로드 JS(gzip):

| 화면 | 기준 | 작업 2 | 작업 3 | 작업 6 |
|---|---|---|---|---|
| 홈 | 534KB | 487KB | 426KB | 389KB |
| 덱 게시판 | 577KB | 531KB | 470KB | 432KB |
| 덱 상세 | 572KB | 556KB | 495KB | 428KB |
| 플랜 상세 | 603KB | — | 525KB | 443KB |
| 플래너 | 643KB | 626KB | 565KB | 483KB |
| 거울 던전 | 477KB | 430KB | 369KB | 369KB |
| 인격 상세 | 547KB | 501KB | 440KB | 402KB |
| 메타 | 516KB | 469KB | 408KB | 370KB |
| 보유 현황 | 489KB | 425KB | 364KB | 326KB |
| `licenses`(틀만) | 402KB | 338KB | 277KB | 277KB |

- 작업 2: zod, 움직임 기능 묶음, 번역 사전을 레이아웃 묶음에서 뺐다. 덱 상세·플래너는 페이지가 zod를 직접 써서 덜 줄었다.
- 작업 3: 브라우저 Sentry(첫 로드 약 80KB, `@sentry/core`·`browser`·`browser-utils`·`nextjs`)를 페이지가 한가해진 뒤 불러온다(`instrumentation-client.ts` → `lib/sentry/client-init.ts`). 그 전의 오류는 `lib/sentry/early.ts`가 최대 20개 모았다가 시작 직후 보낸다. 시작 전 화면 이동은 추적하지 않는다.
- Lighthouse 휴대폰, 같은 기계 3회 중앙값(점수 / LCP / TBT):

| 화면 | 기준 | 작업 2 | 작업 3 |
|---|---|---|---|
| 홈 | 61 / 9.7s / 325ms | 60 / 9.6s / 338ms | 62 / 8.7s / 309ms |
| 덱 게시판 | 49 / 11.0s / 423ms | 49 / 10.4s / 429ms | 49 / 10.2s / 438ms |
| 거울 던전 | 58 / 8.7s / 210ms | 58 / 8.4s / 227ms | 59 / 8.3s / 210ms |

- 작업 4(옛 브라우저용 코드): 고칠 것 없음. Lighthouse가 짚은 36KB는 Next 기본 폴리필 모듈(압축 614바이트, 청크 전체를 셈)과 Sentry 청크(작업 3 뒤 페이지가 한가할 때 불러옴)였다.
- 작업 6(큰 화면 나누기): 네 화면이 따로 받던 것 중 큰 셋을 첫 로드에서 뺐다. 글자 재는 `@chenglou/pretext`(40KB)는 E.G.O 카드가 이름을 잴 때 불러오고(두 hook은 이미 그랬다), 시리즈 검증 `zod`(33KB)는 서버 파일 `features/community/server/series-schema.ts`로, 편성 코드의 `pako`(12.5KB)는 코드 복사·붙여넣기를 누를 때 불러온다. 플래너·플랜 상세 −82KB, 덱 상세·시리즈 −68KB, E.G.O 카드를 쓰는 나머지 화면(홈·덱 게시판·인격 상세 등) −38KB. `tests/architecture/page-client-weight.test.ts`가 막는다.
- 작업 5(서버 조회 병렬): 덱 상세는 덱을 받은 뒤 시리즈·추천·E.G.O 스킬·작성자를 한꺼번에(DB 왕복 4번 → 1번), 덱 수정은 로그인 확인과 덱·게임 데이터를 함께 읽는다. 덱 상세 캐시 빈 첫 요청(덱 5개 × 3회, 매번 `fetch-cache`를 비우고 서버를 새로 띄움) 평균 0.729s → 0.690s. 나머지 서버 페이지는 이미 묶여 있거나 `cacheLife('max')`라 거의 늘 캐시에서 나온다.
- 작업 7(목록 이미지): 고칠 것 없음. 인격·E.G.O 목록과 수감자 상세는 화면 밖 이미지를 이미 나중에 받고, 거울 던전의 화면 밖 미리 받기 46개는 같은 기프트 틀 그림 하나(요청 1번)다. 덱·플랜 게시판 선반의 인격 카드 장식(약 105KB)을 lazy로 바꿔 봤지만 요청 수가 그대로였다(101개 529KB → 100개 527KB): 크롬은 화면에서 약 1250~2500px 안의 lazy 그림을 미리 받는데 선반이 1860px쯤에 있다. 되돌렸다.
- 작업 8(공용 설정 다시 그리기): 고칠 것 없음. 키워드·게임 텍스트 참조는 값을 `useMemo`로 고정하고, SWR 설정은 서버 레이아웃 아래라 페이지를 옮겨도 다시 그려지지 않는다.
- 작업 9(글꼴): 그대로. 첫 로드에 미리 받는 글꼴은 Bebas 17KB, Pretendard 라틴·한글 1 각 70KB, 제목 KOTRA 133KB다. KOTRA 미리 받기를 끄면 휴대폰(느린 4G, 4배 느린 CPU, 3회 중앙값) FCP가 약 0.65초 빨라지지만(홈 2.34→1.69초), 첫 방문 때 제목이 대체 글꼴로 보이는 시간이 빠른 4G 0~0.27초 → 0.4~0.7초, 느린 4G 약 1.8초 → 4.2초로 는다. 소유자 결정(2026-11-07): 제목은 처음부터 KOTRA로 둔다.
- 휴대폰 점수를 깎는 것은 JS 크기보다 LCP(큰 그림·글꼴)와 화면 밀림(CLS)이다.
- 한 번만 잰 휴대폰 숫자는 같은 빌드에서도 점수가 10점, LCP가 몇 초씩 흔들린다. 전후 비교는 `--runs 3` 이상으로 한다.

## 크기 한도

`perf-budget.json`이 화면 9개와 `/[lang]/licenses`의 첫 로드 JS·CSS 한도(gzip KB)를 정한다. 작업 9까지 끝난 숫자에 5%를 더한 값이다. CI의 Build 잡이 빌드 뒤 `npm run perf:budget`으로 재서, 넘는 라우트가 있거나 한도에 적힌 라우트가 빌드에 없으면 실패한다.

- 넘으면 먼저 줄인다(`npx next analyze -o`로 무엇이 들어왔는지 본다).
- 늘려야 하면 PR에 이유를 적고 `perf-budget.json`의 그 칸을 고친다. 라우트 이름이 바뀌면 한도 칸도 옮긴다.

## 처음과 끝

계획 3 전후, 첫 로드 JS(gzip):

| 화면 | 처음(2026-11-07 아침) | 끝 | 줄어든 양 |
|---|---|---|---|
| 홈 | 534KB | 389KB | −145KB (27%) |
| 덱 게시판 | 577KB | 432KB | −145KB (25%) |
| 덱 상세 | 572KB | 428KB | −144KB (25%) |
| 플랜 상세 | 603KB | 443KB | −160KB (27%) |
| 플래너 | 643KB | 483KB | −160KB (25%) |
| 거울 던전 | 477KB | 369KB | −108KB (23%) |
| 인격 상세 | 547KB | 402KB | −145KB (27%) |
| 메타 | 516KB | 370KB | −146KB (28%) |
| 보유 현황 | 489KB | 326KB | −163KB (33%) |
| `licenses`(틀만) | 402KB | 277KB | −125KB (31%) |

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

- 작업 2에서 뺀 것: zod(서버 전용 `lib/push/schema.ts`로), 움직임 기능 묶음(`LazyMotion`이 페이지 뒤에 불러옴), 번역 사전(광고 상수는 `lib/seo/ads.ts`, 선물 키워드 번역은 `lib/i18n/gift-keyword.ts`). `tests/architecture/layout-client-weight.test.ts`가 다시 들어오는 것을 막는다.
- 레이아웃이 받는 글꼴 중 미리 불러오는 것(`.p.`): Pretendard 라틴·한글 1, KOTRA, Bebas. 나머지는 쓰일 때 받는다(작업 9 대상).

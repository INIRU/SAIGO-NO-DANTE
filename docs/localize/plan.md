# i18n 구현 — next-intl 마이그레이션

> 영어(en, 기본) / 한국어(ko) / 일본어(ja) 지원. next-intl v4 기반.

## 아키텍처

### URL 구조
- `localePrefix: 'always'` — `/en/sinners`, `/ko/sinners`, `/ja/sinners`
- `defaultLocale: 'en'` — 로케일 없는 URL은 `/en/`으로 리다이렉트

### 핵심 파일
| 파일 | 역할 |
|------|------|
| `lib/i18n/routing.ts` | `defineRouting()` — 로케일, 기본 로케일, 접두사 설정 |
| `lib/i18n/request.ts` | `getRequestConfig()` — 서버 사이드 로케일 결정 + 메시지 로드 |
| `lib/i18n/navigation.ts` | `createNavigation(routing)` — `Link`, `useRouter`, `usePathname`, `redirect` |
| `messages/ko.json` | 한국어 UI 번역 (nested JSON) |
| `messages/en.json` | 영어 UI 번역 |
| `messages/ja.json` | 일본어 UI 번역 |
| `proxy.ts` | next-intl 미들웨어 (`createMiddleware(routing)`) + `preferred_lang` → `NEXT_LOCALE` 마이그레이션 |

### 레이아웃 구조
```
app/layout.tsx          — <html lang="en"> + 폰트 + 전역 프로바이더
app/[lang]/layout.tsx   — NextIntlClientProvider + SetHtmlLang + Navbar/Footer
```

- `app/layout.tsx`: `<html lang="en" suppressHydrationWarning>` 고정 (getLocale() 사용 시 블로킹 렌더 발생)
- `app/[lang]/layout.tsx`: `SetHtmlLang` 컴포넌트가 useEffect로 `document.documentElement.lang` 업데이트 (하이드레이션 이후)
- `NextIntlClientProvider`에 `locale`, `messages`, `now`, `timeZone` 명시 필수

### 번역 유형

#### 1. UI 텍스트 (next-intl messages)
- `useTranslations()` / `getTranslations()` 사용
- `messages/{locale}.json` 파일에서 로드
- ICU 메시지 포맷: `t('key', { n: 1 })` (`.replace()` 사용 금지)

#### 2. 게임 데이터 (DB 컬럼)
- `name_en`, `name_jp` 등 DB 컬럼에 저장
- `getLocalizedName(item, lang)`, `getLocalizedAffiliation()` 등 헬퍼 사용
- `lib/i18n/index.ts`의 유틸 함수로 로케일별 데이터 반환

#### 3. AI 요약 (언어별 생성)
- 선택 언어로 AI 프롬프트 전송 → 해당 언어 응답 캐싱
- `IdentityAISection.tsx`에서 locale 기반 요약 요청

### 'use cache' 페이지 주의사항
- `'use cache'` + next-intl `Link` = `headers()` 충돌
- 해결: 해당 페이지에서 `import Link from 'next/link'` 사용 (미들웨어가 리다이렉트 처리)
- 영향 파일: `decks`, `story`, `story/prologue`, `story/[chapterId]`, `terms`, `privacy`, `announcements`, `offline`

### 클라이언트 컴포넌트 네비게이션
- `useRouter`, `usePathname` → `@/lib/i18n/navigation`에서 import (로케일 접두사 자동 처리)
- `useSearchParams`, `useParams`, `notFound` → `next/navigation`에서 import (로케일 무관)

## 데이터 동기화

### EGO 스킬/패시브 EN/JP
- `scripts/sync/identity-data.ts`에서 `loadEgoSkillLocale()`, `loadEgoPassiveLocale()` 사용
- 게임 로케일 파일: `assets/data/kr/KR_Skills_Ego.json`, `EN_Skills_Ego.json`, `JP_Skills_Ego.json`

### EGO 획득 방법
- `obtaining_method` (한국어 수동 입력)
- `EGODetailClient.tsx`의 `localizeObtainingMethod()` 함수로 클라이언트 사이드 번역
- 키워드 매핑: 기본, 추출, 특정 추출, 배틀 패스, 정기검진, 자아 파편 등

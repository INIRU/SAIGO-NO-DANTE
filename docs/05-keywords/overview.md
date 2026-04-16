# 키워드 사전

> 게임 내 모든 키워드(상태이상, 효과, 조건 등)를 사전 형태로 조회하는 기능

**페이지**: `/keywords`

---

## 기능 요약

키워드 사전은 림버스 컴퍼니의 전투 키워드를 아이콘, 설명, 최대 중첩 수, 죄악 속성과 함께 사전 형태로 제공한다. 인격/E.G.O 상세 페이지, 거울 던전 플래너 등 사이트 전역에서 키워드 툴팁으로 연동된다.

## 데이터 모델

### DB 테이블: `limbus.keyword_meta`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `name` | `text` (PK) | 키워드 이름 (예: `화상`, `출혈`) |
| `description` | `text` | 키워드 설명 |
| `max_stack` | `integer` | 최대 중첩 수 |
| `icon_slug` | `text` | 아이콘 파일명 슬러그 |
| `sin_affinity` | `text` | 죄악 속성 (분노, 색욕 등) |

### 이미지 저장소

```
Supabase Storage
└── icons/keywords/{icon_slug}.webp
```

## API

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/api/keyword-meta` | GET | 전체 키워드 메타데이터 조회 |
| `/api/admin/keywords` | GET/POST | 키워드 관리 (관리자) |
| `/api/admin/keywords/[name]` | PUT/DELETE | 개별 키워드 수정/삭제 (관리자) |

## 핵심 컴포넌트

### KeywordProvider

| 항목 | 설명 |
|------|------|
| 파일 | `components/providers/KeywordProvider.tsx` |
| 역할 | 키워드 메타를 전역 Context로 제공 |
| 사용처 | `KeywordTooltip`, `KeywordChip` 등 사이트 전역 |
| 데이터 흐름 | 마운트 시 `/api/keyword-meta` 호출 -> Context에 캐시 |

### KeywordChip

| 항목 | 설명 |
|------|------|
| 파일 | `components/ui/KeywordChip.tsx` |
| 역할 | 키워드 이름 + 아이콘을 표시하는 자동 색상 뱃지 |
| Props | `keyword`, `size`, `showIcon`, `color` |
| 색상 로직 | 죄악 속성에 따라 자동으로 배지 색상 결정 |

### KeywordTooltip

| 항목 | 설명 |
|------|------|
| 파일 | `components/sinners/KeywordTooltip.tsx` |
| 역할 | 호버/클릭 시 키워드 전체 설명을 보여주는 툴팁 |
| 데이터 소스 | `KeywordProvider` Context에서 조회 |
| 상호작용 | 데스크탑: hover, 모바일: click |

## 주요 흐름

```
KeywordProvider (앱 전역)
  └── /api/keyword-meta → keyword_meta 테이블 전체 조회
       └── Context에 Map<name, KeywordMeta> 캐시

/keywords 페이지
  └── 키워드 목록 → KeywordChip (아이콘 + 이름 뱃지)
       └── 클릭/호버 → KeywordTooltip (설명, max_stack, sin_affinity)

인격/E.G.O 상세 등 다른 페이지
  └── 스킬/패시브 키워드 → KeywordChip → KeywordTooltip
```

## 관리자 기능

- `/admin/keywords` 페이지에서 키워드 CRUD 관리
- 아이콘 슬러그 지정 시 Supabase Storage `icons/keywords/` 경로에 이미지 업로드 필요

## i18n 지원

### 번역키 네임스페이스

`lib/i18n/translations.ts`의 `keyword.*` 네임스페이스에서 관리한다.

| 키 | 설명 |
|---|---|
| `keyword.error.quote` | 키워드 페이지 에러 화면 메인 인용문 |
| `keyword.error.subQuote` | 키워드 페이지 에러 화면 서브 인용문 |

### DB 컬럼 (다국어 필드)

`limbus.keyword_meta` 테이블에 언어별 컬럼이 추가되어 있다.

| 컬럼 | 설명 |
|---|---|
| `name_en` | 영문 키워드 이름 |
| `name_jp` | 일본어 키워드 이름 |
| `description_en` | 영문 키워드 설명 |
| `description_jp` | 일본어 키워드 설명 |

### 로컬라이즈 유틸

`lib/i18n/localize.ts`에 다음 헬퍼 함수가 정의되어 있다.

- `getLocalizedKeywordName(keyword, lang)` — 언어에 맞는 키워드 이름 반환
- `getLocalizedKeywordDesc(keyword, lang)` — 언어에 맞는 키워드 설명 반환

### 지원 언어

`ko` (한국어), `en` (영어), `ja` (일본어) — `lib/i18n/types.ts`의 `SupportedLang` 참조.

### 주의사항

- 카테고리 `value`는 한국어 문자열 그대로 유지한다 (DB 값이므로 변경 금지). `label`만 로컬라이즈한다.
- `SIN_LABELS`는 `sin.*` 번역키를 사용한다 (중복 상수 제거됨).

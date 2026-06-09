# 관리자 대시보드

> 사이트 전체 데이터 및 콘텐츠를 관리하는 관리자 전용 패널

**페이지**: `/admin/*` (13개 관리 페이지)

---

## 기능 요약

관리자 대시보드는 게임 데이터 CRUD, 키워드 관리, 티어 리스트 관리, 덱 모더레이션, 사용자 관리, 공지사항, 유지보수 모드 토글, 감사 로그 등 사이트 운영에 필요한 모든 관리 기능을 제공한다.

## 인증

| 항목 | 설명 |
|------|------|
| 인증 방식 | NextAuth 세션 체크 |
| 필요 권한 | `admin` 역할 |
| 비인가 접근 | 로그인 페이지로 리다이렉트 |
| API 보호 | 모든 `/api/admin/*` 라우트에 세션 + 역할 검증 |

## 관리 페이지 목록

| 경로 | 기능 | 설명 |
|------|------|------|
| `/admin` | 대시보드 | 통계 카드 (사용자 수, 덱 수, 조회 수 등) |
| `/admin/data` | 게임 데이터 관리 | 죄수/인격/스킬/패시브/E.G.O 편집 |
| `/admin/data/identities/[id]` | 인격 편집 | 개별 인격 상세 수정 |
| `/admin/data/identities/new` | 인격 추가 | 새 인격 등록 |
| `/admin/data/ego/[id]` | E.G.O 편집 | 개별 E.G.O 상세 수정 |
| `/admin/data/ego/new` | E.G.O 추가 | 새 E.G.O 등록 |
| `/admin/keywords` | 키워드 관리 | 키워드 메타데이터 CRUD |
| `/admin/tier-list` | 티어 리스트 관리 | 리세 인격 수동 티어 배치 |
| `/admin/decks` | 덱 관리 | 덱 모더레이션 (신고된 덱 삭제 등) |
| `/admin/users` | 사용자 관리 | 사용자 목록, 역할 변경, 계정 삭제 |
| `/admin/announcements` | 공지사항 관리 | 공지 작성/수정/삭제 |
| `/admin/maintenance` | 유지보수 관리 | 페이지별 유지보수 모드 토글 |
| `/admin/audit-logs` | 감사 로그 | 관리자 활동 이력 조회 |
| `/admin/legal` | 법적 문서 편집 | 개인정보처리방침, 이용약관 수정 |
| `/admin/legal/[type]` | 법적 문서 타입 편집 | privacy/terms 개별 편집 |

## API 라우트

### 통계 및 공통

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/api/admin/stats` | GET | 대시보드 통계 |
| `/api/admin/audit-logs` | GET | 감사 로그 조회 |
| `/api/admin/legal` | GET/POST | 법적 문서 관리 |

### 게임 데이터 CRUD

| 엔드포인트 | 메서드 | 대상 |
|------------|--------|------|
| `/api/admin/identities` | POST | 인격 추가 |
| `/api/admin/identities/[id]` | PUT/DELETE | 인격 수정/삭제 |
| `/api/admin/skills` | POST | 스킬 추가 |
| `/api/admin/skills/[id]` | PUT/DELETE | 스킬 수정/삭제 |
| `/api/admin/passives` | POST | 패시브 추가 |
| `/api/admin/passives/[id]` | PUT/DELETE | 패시브 수정/삭제 |
| `/api/admin/ego` | POST | E.G.O 추가 |
| `/api/admin/ego/[id]` | PUT/DELETE | E.G.O 수정/삭제 |
| `/api/admin/ego-skills` | POST | E.G.O 스킬 추가 |
| `/api/admin/ego-skills/[id]` | PUT/DELETE | E.G.O 스킬 수정/삭제 |

### 콘텐츠 관리

| 엔드포인트 | 메서드 | 대상 |
|------------|--------|------|
| `/api/admin/keywords` | GET/POST | 키워드 목록/추가 |
| `/api/admin/keywords/[name]` | PUT/DELETE | 키워드 수정/삭제 |
| `/api/admin/tier-list` | GET/PUT | 티어 리스트 조회/수정 |
| `/api/admin/announcements` | GET/POST | 공지사항 목록/작성 |
| `/api/admin/announcements/[id]` | PUT/DELETE | 공지사항 수정/삭제 |
| `/api/admin/decks` | GET | 덱 목록 (모더레이션) |
| `/api/admin/decks/[id]` | DELETE | 덱 삭제 |
| `/api/admin/users` | GET | 사용자 목록 |
| `/api/admin/users/[id]` | PUT/DELETE | 사용자 수정/삭제 |
| `/api/admin/maintenance` | GET/POST/PUT/DELETE | 유지보수 모드 관리 |

## 유지보수 모드

- **페이지별 토글**: 개별 페이지 단위로 유지보수 모드를 설정하고 `/` 경로로 전체 공개 사이트 점검도 설정 가능
- **proxy.ts 연동**: `proxy.ts` 미들웨어에서 유지보수 상태를 체크하여 같은 언어의 `/[lang]/maintenance` 페이지로 rewrite
- **locale-aware 매칭**: 관리 화면에는 `/sinners`처럼 locale 없는 경로를 저장하며, `/ko/sinners`, `/en/sinners`, `/ja/sinners` 요청은 같은 항목으로 매칭
- **관리자 제외**: 관리자 세션은 유지보수 모드에서도 원래 페이지 접근 가능

## 관리자 UI 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `AdminButton` | `components/admin/AdminButton.tsx` | 관리자 전용 버튼 |
| `AdminCard` | `components/admin/AdminCard.tsx` | 통계/정보 카드 |
| `AdminTable` | `components/admin/AdminTable.tsx` | 데이터 테이블 |
| `AdminToast` | `components/admin/AdminToast.tsx` | 토스트 알림 |
| `AdminFormSection` | `components/admin/AdminFormSection.tsx` | 폼 섹션 래퍼 |
| `AdminInput` | `components/admin/AdminInput.tsx` | 입력 필드 |

## 감사 로그

- 모든 관리자 CRUD 작업이 감사 로그에 기록됨
- `/admin/audit-logs` 페이지에서 활동 이력 조회
- 기록 항목: 수행자, 액션, 대상, 타임스탬프

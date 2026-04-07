# 덱 빌더 (Deck Builder)

## 페이지 라우트

| 경로 | 설명 |
|------|------|
| `/decks` | 덱 보드 (커뮤니티 공유 덱 목록) |
| `/decks/new` | 덱 빌더 (새 덱 생성) |
| `/decks/[id]` | 덱 상세 (인격 카드, E.G.O 기프트, 댓글) |
| `/decks/[id]/edit` | 덱 수정 |

## DB 테이블

| 테이블 | 주요 컬럼 | 설명 |
|--------|-----------|------|
| `decks` | id, user_id, title, description, tags, created_at | 덱 기본 정보 |
| `deck_identities` | deck_id, identity_id, slot_order | 덱에 포함된 인격 (12슬롯) |
| `deck_votes` | deck_id, user_id, vote_type | 덱 투표 (upvote/downvote) |
| `deck_comments` | id, deck_id, user_id, content, created_at, parent_id | 덱 댓글 (대댓글 지원, ON DELETE CASCADE) |
| `identities` | (인격 정보) | 덱에 포함된 인격 참조 |
| `ego` | (E.G.O 정보) | 활성 E.G.O 기프트 참조 |
| `profiles` | (사용자 프로필) | 덱 작성자 정보 |

## 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `DeckBuilderClient` | `app/decks/new/DeckBuilderClient.tsx` | 덱 빌더 클라이언트 (~1800 lines) |
| `DeckCard` | `components/decks/DeckCard.tsx` | 덱 목록 카드 |
| `NoteChips` | `components/decks/NoteChips.tsx` | 노트 태그 칩 |
| `NoteAutocomplete` | `components/notes/NoteAutocomplete.tsx` | 노트 자동완성 입력 |
| `IdentityCard` | `components/sinners/IdentityCard.tsx` | 인격 카드 (덱 상세에서 재사용) |
| `GiftCard` | `components/ui/GiftCard.tsx` | 활성 E.G.O 기프트 카드 |
| `BaseModal` | `components/ui/BaseModal.tsx` | 모달 래퍼 |
| `ConfirmModal` | `components/ui/ConfirmModal.tsx` | 확인/경고 다이얼로그 |

## 사용자 흐름

### 덱 보드 (목록)

1. `/decks` 접근
2. 커뮤니티에서 공유된 덱을 `DeckCard`로 목록 표시
3. **검색**: 덱 제목, 태그 기반 검색
4. **필터**: 태그, 인기순, 최신순 등으로 필터링
5. 덱 카드 클릭 시 `/decks/[id]`로 이동

### 덱 빌더 (생성)

1. `/decks/new` 접근 (로그인 필수)
2. **12슬롯 인격 선택**: 각 수감자별 인격을 선택하여 12개 슬롯 배치
3. **활성 E.G.O 기프트 패널**: 사용할 E.G.O 기프트 선택
4. **노트 작성**: 덱 설명, 전략 메모. `NoteAutocomplete`로 자동완성 지원
5. **태그 설정**: 덱 분류 태그 추가 (`NoteChips`)
6. 저장 시 서버에 덱 정보 + 인격 구성(`deck_identities`) 저장

### 덱 상세

1. `/decks/[id]` 접근
2. **인격 카드**: `IdentityCard` 컴포넌트로 편성된 12명의 인격 표시
3. **활성 E.G.O 기프트**: 아코디언 형태로 선택된 기프트 표시
4. **댓글**: 스레드 형태의 댓글 시스템
   - 최상위 댓글 작성
   - `parent_id`를 통한 대댓글 (답글)
   - 대댓글 삭제 시 CASCADE로 하위 댓글도 삭제
5. **투표**: upvote/downvote 토글
6. **북마크**: 나중에 다시 볼 수 있도록 북마크 저장

### 덱 수정

1. `/decks/[id]/edit` 접근 (본인 덱만 수정 가능)
2. 기존 덱 정보를 불러와 빌더 UI에 표시
3. 인격 변경, 기프트 변경, 노트 수정 후 저장

## 인증 요구사항

다음 기능은 로그인(NextAuth Google OAuth)이 필요합니다:

| 기능 | 인증 필요 | 비고 |
|------|-----------|------|
| 덱 목록 조회 | 불필요 | 누구나 열람 가능 |
| 덱 상세 조회 | 불필요 | 누구나 열람 가능 |
| 덱 생성 | 필수 | `/decks/new` |
| 덱 수정 | 필수 | 본인 덱만 |
| 투표 (upvote/downvote) | 필수 | 사용자당 덱당 1표 |
| 댓글 작성 | 필수 | |
| 북마크 | 필수 | |

## 투표 시스템

- 사용자당 덱당 1표 (토글 방식)
- upvote/downvote 중 하나만 선택 가능
- 이미 투표한 상태에서 같은 버튼 클릭 시 투표 취소
- 반대 투표 클릭 시 기존 투표 변경
- DB RPC: `limbus.increment_vote(deck_id)`, `limbus.decrement_vote(deck_id)`

## 댓글 시스템

- 스레드 기반 대댓글 지원
- `parent_id`로 부모 댓글 참조 (NULL이면 최상위 댓글)
- 부모 댓글 삭제 시 하위 대댓글도 CASCADE 삭제
- 댓글 작성 시 로그인 필수

## API 라우트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/decks` | GET | 덱 목록 조회 |
| `/api/decks` | POST | 덱 생성 (인증 필요) |
| `/api/decks/[id]` | GET | 덱 상세 조회 |
| `/api/decks/[id]/vote` | POST | 투표 토글 (인증 필요) |
| `/api/decks/[id]/bookmark` | POST | 북마크 토글 (인증 필요) |
| `/api/decks/[id]/comments` | GET | 댓글 목록 조회 |
| `/api/decks/[id]/comments` | POST | 댓글 작성 (인증 필요) |

## 관련 페이지 연동

- **마이페이지**: `/mypage`에서 내 덱 목록, 북마크한 덱 확인
- **인격 상세**: `/sinners/[slug]/identities/[id]`의 `IdentityDecksTab`에서 해당 인격이 포함된 덱 목록
- **관리자**: `/admin/decks`에서 덱 관리 (삭제 등)

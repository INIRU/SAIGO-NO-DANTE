# 컴포넌트 카탈로그

> 프로젝트 전역에서 재사용되는 공통 컴포넌트 목록

---

## 디자인 규칙

| 항목 | 규칙 |
|------|------|
| 사이징 | rem 단위만 사용 (px 사용 금지) |
| 테마 | 다크 테마 기본 (배경 `#0d0b08`) |
| 애니메이션 | GSAP (동적 임포트 필수) + Framer Motion |
| 이미지 | Supabase Storage (`STORAGE_BASE` 상수 사용) |
| 모달 | 반드시 `BaseModal` 래퍼 사용 |
| 이미지 컴포넌트 | `ImageWithFallback` 사용 (폴백 처리) |
| z-index | 부모에 `position: relative; zIndex: 0`으로 스태킹 컨텍스트 격리 |

---

## layout/

레이아웃 프레임을 구성하는 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `Navbar` | `components/layout/Navbar.tsx` | 상단 네비게이션 (스크롤 숨김, 모바일 풀스크린 메뉴) |
| `Footer` | `components/layout/Footer.tsx` | 하단 푸터 |

---

## ui/

범용 UI 프리미티브. 사이트 전역에서 재사용된다.

| 컴포넌트 | 파일 | 설명 | 주요 Props |
|----------|------|------|-----------|
| `BaseModal` | `components/ui/BaseModal.tsx` | 모달 래퍼 (ESC 닫기, 스크롤 잠금, 배경 블러) | `open`, `onClose`, `maxWidth`, `blur`, `padding` |
| `GiftCard` | `components/ui/GiftCard.tsx` | 통합 팔각형 기프트 카드 (선택, 강화, 제거, 조건) | `gift`, `onClick`, `isSelected`, `enhance`, `onRemove`, `conditionStatus` |
| `KeywordChip` | `components/ui/KeywordChip.tsx` | 키워드 뱃지 (아이콘 + 이름, 자동 색상) | `keyword`, `size`, `showIcon`, `color` |
| `ThemePackCard` | `components/ui/ThemePackCard.tsx` | 테마 팩 카드 (이미지, 보스, 이름) | `theme`, `onClick`, `isSelected`, `showGiftCount` |
| `GlitchText` | `components/ui/GlitchText.tsx` | 글리치 텍스트 효과 | - |
| `SinBadge` | `components/ui/SinBadge.tsx` | 죄악 속성 뱃지 (아이콘 + 라벨) | `sin`, `size`, `showLabel` |
| `PageTransition` | `components/ui/PageTransition.tsx` | 페이지 전환 애니메이션 | - |
| `ConfirmModal` | `components/ui/ConfirmModal.tsx` | 확인/경고 다이얼로그 | `open`, `title`, `message`, `variant` |
| `Dropdown` | `components/ui/Dropdown.tsx` | 커스텀 드롭다운 | `value`, `options`, `onChange`, `prefix`, `defaultValue`, `minWidth` |
| `FloatingFontControl` | `components/ui/FloatingFontControl.tsx` | 플로팅 폰트 크기 조절 버튼 | - |
| `SearchModal` | `components/ui/SearchModal.tsx` | 글로벌 검색 모달 (Cmd+K / Ctrl+K) | - |
| `ImageWithFallback` | `components/ui/ImageWithFallback.tsx` | 이미지 로드 실패 시 폴백 표시 | - |

---

## sinners/

죄수/인격/E.G.O 관련 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `SinnerCard` | `components/sinners/SinnerCard.tsx` | 죄수 그리드 카드 |
| `IdentityCard` | `components/sinners/IdentityCard.tsx` | 인격 카드 (프레임, 등급, 키워드 뱃지, GSAP 호버) |
| `KeywordTooltip` | `components/sinners/KeywordTooltip.tsx` | 키워드 툴팁 (hover/click으로 전체 설명 표시) |
| `IdentityDecksTab` | `components/sinners/IdentityDecksTab.tsx` | 인격 상세 내 덱 탭 |

---

## decks/

덱 빌더 및 덱 목록 관련 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `DeckCard` | `components/decks/DeckCard.tsx` | 덱 리스트 카드 |
| `NoteChips` | `components/decks/NoteChips.tsx` | 노트 태그 칩 |

---

## planner/

거울 던전 플래너 전용 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `KeywordChart` | `components/planner/KeywordChart.tsx` | 키워드 분포 차트 |
| `PlannerGiftModal` | `components/planner/PlannerGiftModal.tsx` | 플래너 기프트 선택 모달 |

---

## mirror-dungeon/

거울 던전 백과사전 전용 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `GiftCard` | `components/ui/GiftCard.tsx` | 기프트 카드 (ui/GiftCard를 공유) |
| `GiftModal` | 거울 던전 내 모달 | 기프트 상세 모달 |
| `ThemeModal` | 거울 던전 내 모달 | 테마 상세 모달 |

---

## random/

랜덤 편성(슬롯머신) 전용 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `OptionPanel` | `components/random/OptionPanel.tsx` | 옵션 패널 (인격/E.G.O 토글, 컬렉션, 키워드) |
| `KeywordChips` | `components/random/KeywordChips.tsx` | 키워드 선택 칩 + 최소 인원 슬라이더 |
| `SlotMachine` | `components/random/SlotMachine.tsx` | 12개 릴 슬롯머신 컨테이너 + E.G.O 결과 |
| `SlotReel` | `components/random/SlotReel.tsx` | 개별 슬롯 릴 (GSAP 애니메이션) |

---

## identity/

인격 상세 페이지 전용 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `SkillIcon` | `components/identity/SkillIcon.tsx` | 스킬 아이콘 이미지 |

---

## admin/

관리자 페이지 전용 UI 컴포넌트.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `AdminButton` | `components/admin/AdminButton.tsx` | 관리자 버튼 |
| `AdminCard` | `components/admin/AdminCard.tsx` | 관리자 카드 |
| `AdminTable` | `components/admin/AdminTable.tsx` | 관리자 테이블 |
| `AdminToast` | `components/admin/AdminToast.tsx` | 토스트 알림 |
| `AdminFormSection` | `components/admin/AdminFormSection.tsx` | 폼 섹션 래퍼 |
| `AdminInput` | `components/admin/AdminInput.tsx` | 입력 필드 |

---

## providers/

앱 전역 Context Provider.

| 컴포넌트 | 파일 | 설명 |
|----------|------|------|
| `SessionProvider` | `components/providers/SessionProvider.tsx` | NextAuth 세션 Provider |
| `KeywordProvider` | `components/providers/KeywordProvider.tsx` | 키워드 메타 전역 Context (KeywordTooltip에서 사용) |

---

## 이미지 경로 규칙

이미지 URL은 반드시 `lib/utils/images.ts` 헬퍼를 사용한다. 직접 URL을 하드코딩하지 않는다.

| 대상 | 헬퍼 / 소스 | 저장소 경로 |
|------|-------------|-------------|
| 인격 이미지 | `getIdentityImageUrl()` | `sinners/{sinner_id}/identities/{folder_name}/{game_id}_normal.webp` |
| E.G.O 이미지 | `ego.image_url` (DB) | DB에 저장된 전체 URL |
| 기프트 이미지 | `gift.image_url` (DB) | DB에 저장된 전체 URL |
| 키워드 아이콘 | `icon_slug` 기반 | `icons/keywords/{icon_slug}.webp` |
| 스킬 아이콘 | 경로 조합 | `icons/skills/{sinner_id}/{skillId}.webp` |
| SD 스프라이트 | 경로 조합 | `icons/sd/{sinner_id}/{game_id}_idle.webp` |

## 공통 상수

| 상수 | 임포트 경로 | 설명 |
|------|-------------|------|
| `STORAGE_BASE` | `@/lib/constants/game` | Supabase Storage 베이스 URL |
| `OCTAGON_CLIP` | `@/lib/constants/gift` | 팔각형 clip-path 값 |
| `GRADE_ROMAN` | `@/lib/constants/gift` | 등급 로마 숫자 매핑 |

# 플래너 (Planner)

## 페이지 라우트

| 경로 | 설명 |
|------|------|
| `/planner` | 플래너 메인 (편성 + 버프/기프트 설정) |
| `/planner/run` | 거울 던전 시뮬레이션 (층별 기프트 선택, 상점, 조합, 이벤트) |
| `/planner/community` | 플래너 공유 목록 (커뮤니티) |
| `/planner/community/[id]` | 공유된 플랜 상세 보기 |

## DB 테이블

플래너는 **클라이언트 사이드 상태 관리**를 중심으로 동작하며, Zustand store + localStorage에 상태를 유지합니다. 커뮤니티 공유 시 서버 DB에 저장됩니다.

| 테이블 | 설명 |
|--------|------|
| `identities` | 편성 인격 선택 시 참조 |
| `ego` | E.G.O 선택 시 참조 |
| `ego_gifts` | 기프트 선택/조합 시 참조 |
| `ego_gift_themes` | 테마 팩 정보 |
| `ego_gift_recipes` | 조합 레시피 |
| `keyword_meta` | 키워드 표시 |

## 주요 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| `PlannerClient` | `app/planner/PlannerClient.tsx` | 플래너 메인 클라이언트 |
| `DeckTab` | `components/planner/` | 편성 탭 (인격 12슬롯 + E.G.O 선택) |
| `SummaryTab` | `components/planner/` | 요약 탭 |
| `FloorTab` | `components/planner/` | 층별 기프트 탭 |
| `GiftPlanTab` | `components/planner/` | 기프트 계획 탭 |
| `DeckStatsPanel` | `components/planner/` | 공격 유형 분포 + 죄악 자원 + 패시브 |
| `KeywordChart` | `components/planner/KeywordChart.tsx` | 키워드 통계 차트 |
| `PlannerGiftModal` | `components/planner/PlannerGiftModal.tsx` | 기프트 상세 모달 (효과, 레시피) |
| `GiftCard` | `components/ui/GiftCard.tsx` | 팔각형 기프트 카드 |
| `PlanCard` | `components/planner/PlanCard.tsx` | 커뮤니티 플랜 카드 |
| `PlanActions` | `components/planner/PlanActions.tsx` | 플랜 액션 (좋아요/싫어요) |
| `PlanDetailClient` | `app/planner/community/[id]/PlanDetailClient.tsx` | 플랜 상세 클라이언트 |
| `CommunityClient` | `app/planner/community/CommunityClient.tsx` | 커뮤니티 목록 클라이언트 |

## 상태 관리

### Zustand Store (localStorage 영속)

플래너 상태는 Zustand를 통해 관리되며 localStorage에 자동 저장됩니다.

### 주요 상태 타입

```
IdentitySlot: identity_id, sinner_id, name_kr, rarity, keywords, slot_order
EgoSlot: ego_id, sinner_id, name_kr, grade, sin_affinity
EgoData: id, sinner_id, name, grade, sin_affinity, cost (number[])
GiftData: id, game_id, name, keyword, grade, image_url, effect_base/plus/plusplus, activation_condition
```

### 편성 슬롯 시스템

12명의 수감자가 순서가 있는 슬롯을 차지합니다:

| 슬롯 범위 | 유형 | 표시 색상 |
|-----------|------|-----------|
| 1~7 | 편성 (active) | 금색 `#e8b030` |
| 8~12 | 대기 (bench) | 청색 `#5ab0d0` |

- `slot_order`는 DB에 0-indexed (0~11)로 저장, 화면에는 1-indexed로 표시
- `slot_order = 99`는 미배정 상태
- `slot_order < 7`이면 활성 편성, `slot_order < 99`이면 배정됨

### 기프트 인벤토리 ID 형식

`giftInventory`는 접두사가 포함된 문자열 ID로 저장:

| 접두사 | 의미 |
|--------|------|
| `start_{gameId}` | 시작 기프트 |
| `observe_{gameId}` | 관찰 기프트 |
| `final_{gameId}` | 누적 기프트 (기본) |
| `final_{gameId}_plus` | 강화+ |
| `final_{gameId}_plusplus` | 강화++ |
| `blessing_{baseId}_{level}` | 축복 |

## 사용자 흐름

### 플래너 설정 (메인 페이지)

1. `/planner` 접근
2. **편성(DeckTab)**: 12명의 수감자 인격을 슬롯에 배치 (편성 7 + 대기 5)
3. **시작 버프 설정**: 던전 시작 시 적용할 버프 선택
4. **시작 기프트 설정**: 시작 시 보유할 기프트 (`start_` 접두사)
5. **관찰 기프트 설정**: 관찰 대상 기프트 (`observe_` 접두사)
6. **목표 기프트 설정**: 획득 목표 기프트 (`final_` 접두사)
7. `DeckStatsPanel`에서 실시간으로 편성의 공격 유형 분포, 죄악 자원, 패시브 확인
8. `KeywordChart`로 편성의 키워드 통계 시각화

### 죄악 자원 계산

편성의 죄악 자원은 모든 스킬에서 집계됩니다:

- S1, S2, S3, S3-2 변형, 방어 스킬(skill_order 4) 전부 카운트
- 수감자별 중복 제거 없음: S1=우울, S3=우울이면 우울 2개
- 선택된 E.G.O의 `sin_affinity`가 해당 죄악 +1 추가

### 거울 던전 시뮬레이션 (Run 페이지)

1. 플래너 설정 완료 후 "시뮬레이션 시작" 클릭
2. **Plan -> Run 전환**: localStorage를 통해 전체 상태 전달 (URL 인코딩 미사용 - slot_order 등 복잡한 필드 보존)
3. `/planner/run` 페이지에서 층별 진행:
   - **기프트 선택**: 각 층에서 제공되는 기프트 중 선택
   - **상점**: 기프트 구매/판매
   - **조합**: 기프트 3개 합성으로 새 기프트 획득
   - **이벤트**: 거울 던전 이벤트 발생 및 선택

### 커뮤니티 공유

1. 플래너 설정 완료 후 "공유" 버튼 클릭
2. 편성 및 기프트 설정이 서버에 저장
3. `/planner/community`에서 공유된 플랜 목록 확인
4. `PlanCard`로 플랜 카드 표시
5. 플랜 클릭 시 `/planner/community/[id]`에서 상세 확인
6. **좋아요/싫어요**: `PlanActions`를 통한 투표 기능

## 관련 페이지 연동

- **마이페이지**: `/mypage`의 `PlannerTab`에서 내가 작성한 플래너 목록 확인
- **커뮤니티 목록 최적화**: `stripPlanForList` (`lib/planner/stripPlanForList.ts`)로 목록 표시 시 불필요한 데이터 제거

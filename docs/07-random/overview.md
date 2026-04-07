# 랜덤 편성

> 슬롯머신 UI로 랜덤 인격/E.G.O 편성을 뽑는 기능

**페이지**: `/random`

---

## 기능 요약

12명의 죄수에 대해 슬롯머신 애니메이션으로 랜덤 인격 편성을 생성한다. 키워드 필터, 최소 인원 설정, 컬렉션 연동(보유 인격만) 등 다양한 옵션을 제공한다.

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| 인격/E.G.O 토글 | 인격만, E.G.O만, 또는 둘 다 | 인격만 |
| 키워드 필터 | 특정 키워드를 가진 인격만 포함 | 없음 |
| 최소 인원 | 편성에 포함할 최소 죄수 수 | 12 |
| 컬렉션 전용 모드 | 보유 중인 인격/E.G.O만 대상 | OFF |

## 핵심 컴포넌트

### OptionPanel

| 항목 | 설명 |
|------|------|
| 파일 | `components/random/OptionPanel.tsx` |
| 역할 | 인격/E.G.O 토글, 컬렉션 모드, 키워드 필터 옵션 패널 |

### KeywordChips

| 항목 | 설명 |
|------|------|
| 파일 | `components/random/KeywordChips.tsx` |
| 역할 | 키워드 선택 칩 목록 + 최소 인원 슬라이더 |

### SlotMachine

| 항목 | 설명 |
|------|------|
| 파일 | `components/random/SlotMachine.tsx` |
| 역할 | 12개 릴을 감싸는 슬롯머신 컨테이너 + E.G.O 결과 표시 |

### SlotReel

| 항목 | 설명 |
|------|------|
| 파일 | `components/random/SlotReel.tsx` |
| 역할 | 개별 슬롯 릴 (GSAP 애니메이션) |
| 애니메이션 | GSAP `dynamic import` -> 릴 회전 -> 감속 -> 정지 |

### RandomClient

| 항목 | 설명 |
|------|------|
| 파일 | `app/random/RandomClient.tsx` |
| 역할 | 페이지 클라이언트 (옵션, 슬롯머신, 결과 통합) |

## 컬렉션 연동

- `/collection` 페이지에서 설정한 보유 인격/E.G.O 목록과 연동
- 컬렉션 전용 모드 ON 시: 보유한 인격만 슬롯머신 후보에 포함
- URL 파라미터로 컬렉션 상태를 전달받음

## 애니메이션

```
GSAP 동적 임포트 (SSR 방지)
  └── const gsap = (await import('gsap')).default

SlotReel 애니메이션 시퀀스:
  1. 릴 고속 회전 시작
  2. 릴별 시차(stagger)로 순차 감속
  3. 최종 인격에서 정지 + 바운스 효과
```

> **주의**: GSAP는 반드시 동적 임포트로 사용한다. 최상위 import는 SSR을 깨뜨린다.

## 페이지 흐름

```
사용자 옵션 설정 (OptionPanel)
  └── 키워드 선택 (KeywordChips)
       └── "뽑기" 버튼 클릭
            └── 슬롯머신 애니메이션 (SlotMachine > SlotReel x12)
                 └── 결과 표시 (인격 카드 + E.G.O)
```

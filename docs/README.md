# Limbus Company DB 데이터 레퍼런스

현재 Supabase DB에 저장된 모든 인격/EGO 데이터 정리.
데이터 시딩 시 참조용 — 중복 입력 및 실수 방지 목적.

## 요약

| 수감자 | 인격 수 | EGO 수 | 파일 |
|---|---|---|---|
| 이상 | 15 | 8 | [sinners/yi-sang.md](sinners/yi-sang.md) |
| 파우스트 | 14 | 9 | [sinners/faust.md](sinners/faust.md) |
| 돈키호테 | 14 | 9 | [sinners/don-quixote.md](sinners/don-quixote.md) |
| 료슈 | 13 | 9 | [sinners/ryoshu.md](sinners/ryoshu.md) |
| 뫼르소 | 13 | 8 | [sinners/meursault.md](sinners/meursault.md) |
| 홍루 | 13 | 9 | [sinners/hong-lu.md](sinners/hong-lu.md) |
| 히스클리프 | 14 | 9 | [sinners/heathcliff.md](sinners/heathcliff.md) |
| 이스마엘 | 14 | 10 | [sinners/ishmael.md](sinners/ishmael.md) |
| 로쟈 | 14 | 8 | [sinners/rodion.md](sinners/rodion.md) |
| 싱클레어 | 15 | 8 | [sinners/sinclair.md](sinners/sinclair.md) |
| 오티스 | 14 | 9 | [sinners/outis.md](sinners/outis.md) |
| 그레고르 | 14 | 9 | [sinners/gregor.md](sinners/gregor.md) |
| **합계** | **167** | **105** | |

## DB 스키마 참고

### identities 컬럼
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| sinner_id | text | FK → sinners.id |
| name | text | 영문명 |
| name_kr | text | 한글명 |
| tier | integer | 등급 (1~3) |
| rarity | text | 레어리티 |
| hp | integer | HP |
| speed_min/max | integer | 속도 범위 |
| def_level | integer | 방어 레벨 |
| slash/pierce/blunt_res | text | 내성 |
| keywords | text[] | 키워드 배열 |
| affiliation | text | 소속 |
| release_date | text | 출시일 |
| acquisition | text | 획득처 |
| game_id | text | 게임 내 ID |
| folder_name | text | 에셋 폴더명 |
| panic_type | text | 패닉 타입 |
| quote | text | 대사 |

### ego 컬럼
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| sinner_id | text | FK → sinners.id |
| name | text | 영문명 |
| name_kr | text | 한글명 |
| grade | text | 등급 (ZAYIN~ALEPH) |
| sin_affinity | text | 죄악 속성 |
| description | text | 설명 |
| corrosion_risk | text | 침식 위험도 |
| folder_name | text | 에셋 폴더명 |
| image_url / cor_image_url | text | 이미지 URL |
| passive_name | text | 패시브명 |
| passive_content | text | 패시브 내용 |
| ego_skills | jsonb | EGO 스킬 데이터 |
| ego_cor_skills | jsonb | 침식 스킬 데이터 |
| resistance | text[] | 내성 배열 |
| cost | text[] | 자원 비용 배열 |
| keywords | text[] | 키워드 배열 |
| obtaining_method | text | 획득 방법 |
| game_id | text | 게임 내 ID |

### skills 컬럼
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| identity_id | uuid | FK → identities.id |
| name | text | 스킬명 |
| skill_type | text | 공격 타입 |
| sin_affinity | text | 죄악 속성 |
| base_power | integer | 기본 위력 |
| coins | integer | 코인 수 |
| coin_power | integer | 코인 위력 |
| offense_level | integer | 공격 레벨 |
| atk_weight | integer | 가중치 |
| quantity | integer | 개수 |
| defense_level | integer | 방어 레벨 |
| skill_order | integer | 스킬 순서 |
| uptie_level | integer | 동기화 레벨 (3 or 4) |

### passives 컬럼
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| identity_id | uuid | FK → identities.id |
| passive_type | text | 배틀/서포트 |
| name | text | 패시브명 |
| sin_affinity | text | 죄악 속성 |
| sin_count | integer | 필요 자원 수 |
| active_cond | text | 발동 조건 (공명/보유) |
| description | text | 설명 |
| passive_order | integer | 순서 |
| uptie_level | integer | 동기화 레벨 (3 or 4) |
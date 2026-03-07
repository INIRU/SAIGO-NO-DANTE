import { describe, it, expect } from 'vitest'
import {
  STORAGE_BASE,
  SINNER_SLUGS,
  LCB_IDS,
  GRADE_COLORS,
  RARITY_COLORS,
  SKILL_TYPE_LABELS,
} from '@/lib/constants/game'

describe('STORAGE_BASE', () => {
  it('Supabase Storage URL이어야 한다', () => {
    expect(STORAGE_BASE).toContain('supabase.co/storage/v1/object/public/limbus-assets')
  })
})

describe('SINNER_SLUGS', () => {
  it('12명의 수감자 슬러그가 정의되어 있어야 한다', () => {
    expect(SINNER_SLUGS).toHaveLength(12)
  })

  it('모든 수감자 이름이 포함되어야 한다', () => {
    expect(SINNER_SLUGS).toContain('yi-sang')
    expect(SINNER_SLUGS).toContain('faust')
    expect(SINNER_SLUGS).toContain('ryoshu')
    expect(SINNER_SLUGS).toContain('gregor')
  })
})

describe('LCB_IDS', () => {
  it('12명의 LCB 인격 ID가 정의되어 있어야 한다', () => {
    expect(Object.keys(LCB_IDS)).toHaveLength(12)
  })

  it('ID는 5자리 숫자 형식이어야 한다', () => {
    for (const id of Object.values(LCB_IDS)) {
      expect(id).toMatch(/^\d{5}$/)
    }
  })

  it('수감자 순서에 맞는 ID 패턴이어야 한다', () => {
    expect(LCB_IDS['yi-sang']).toBe('10101')
    expect(LCB_IDS['faust']).toBe('10201')
    expect(LCB_IDS['gregor']).toBe('11201')
  })
})

describe('GRADE_COLORS', () => {
  it('5가지 EGO 등급 색상이 정의되어 있어야 한다', () => {
    expect(GRADE_COLORS['ZAYIN']).toBeDefined()
    expect(GRADE_COLORS['TETH']).toBeDefined()
    expect(GRADE_COLORS['HE']).toBeDefined()
    expect(GRADE_COLORS['WAW']).toBeDefined()
    expect(GRADE_COLORS['ALEPH']).toBeDefined()
  })
})

describe('RARITY_COLORS', () => {
  it('3가지 등급(1~3성) 색상이 정의되어 있어야 한다', () => {
    for (const r of [1, 2, 3]) {
      expect(RARITY_COLORS[r]).toBeDefined()
      expect(RARITY_COLORS[r].border).toMatch(/^#/)
      expect(RARITY_COLORS[r].glow).toMatch(/^rgba/)
    }
  })
})

describe('SKILL_TYPE_LABELS', () => {
  it('공격 타입 한글 라벨이 정의되어 있어야 한다', () => {
    expect(SKILL_TYPE_LABELS['slash']).toBe('참격')
    expect(SKILL_TYPE_LABELS['pierce']).toBe('관통')
    expect(SKILL_TYPE_LABELS['blunt']).toBe('타격')
  })

  it('방어 타입 한글 라벨이 정의되어 있어야 한다', () => {
    expect(SKILL_TYPE_LABELS['defense']).toBe('방어')
    expect(SKILL_TYPE_LABELS['counter']).toBe('반격')
    expect(SKILL_TYPE_LABELS['evade']).toBe('회피')
  })
})

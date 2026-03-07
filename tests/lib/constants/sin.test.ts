import { describe, it, expect } from 'vitest'
import { SIN_COLORS, SIN_LABELS_KR, SIN_KR_TO_EN, normalizeSin, SIN_ORDER } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'

describe('SIN_COLORS', () => {
  it('7가지 죄악 색상이 모두 정의되어 있어야 한다', () => {
    const sins: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
    for (const sin of sins) {
      expect(SIN_COLORS[sin]).toBeDefined()
      expect(SIN_COLORS[sin]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('SIN_LABELS_KR', () => {
  it('모든 죄악의 한글 라벨이 정의되어 있어야 한다', () => {
    expect(SIN_LABELS_KR.wrath).toBe('분노')
    expect(SIN_LABELS_KR.lust).toBe('색욕')
    expect(SIN_LABELS_KR.sloth).toBe('나태')
    expect(SIN_LABELS_KR.gluttony).toBe('탐식')
    expect(SIN_LABELS_KR.gloom).toBe('우울')
    expect(SIN_LABELS_KR.pride).toBe('오만')
    expect(SIN_LABELS_KR.envy).toBe('질투')
  })
})

describe('SIN_KR_TO_EN', () => {
  it('한글 죄악명을 영문으로 변환해야 한다', () => {
    expect(SIN_KR_TO_EN['분노']).toBe('wrath')
    expect(SIN_KR_TO_EN['색욕']).toBe('lust')
    expect(SIN_KR_TO_EN['우울']).toBe('gloom')
  })

  it('폭식은 gluttony의 별칭이어야 한다', () => {
    expect(SIN_KR_TO_EN['폭식']).toBe('gluttony')
    expect(SIN_KR_TO_EN['탐식']).toBe('gluttony')
  })

  it('존재하지 않는 키는 undefined를 반환해야 한다', () => {
    expect(SIN_KR_TO_EN['없는죄악']).toBeUndefined()
  })
})

describe('normalizeSin', () => {
  it('영문 죄악명을 그대로 반환해야 한다', () => {
    expect(normalizeSin('wrath')).toBe('wrath')
    expect(normalizeSin('envy')).toBe('envy')
  })

  it('한글 죄악명을 영문으로 변환해야 한다', () => {
    expect(normalizeSin('분노')).toBe('wrath')
    expect(normalizeSin('질투')).toBe('envy')
  })

  it('null이면 null을 반환해야 한다', () => {
    expect(normalizeSin(null)).toBeNull()
  })

  it('인식할 수 없는 값이면 null을 반환해야 한다', () => {
    expect(normalizeSin('unknown')).toBeNull()
    expect(normalizeSin('')).toBeNull()
  })
})

describe('SIN_ORDER', () => {
  it('7가지 죄악이 올바른 순서로 정의되어 있어야 한다', () => {
    expect(SIN_ORDER).toHaveLength(7)
    expect(SIN_ORDER[0]).toBe('wrath')
    expect(SIN_ORDER[6]).toBe('envy')
  })
})

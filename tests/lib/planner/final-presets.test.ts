import { describe, expect, it } from 'vitest'
import { compactFinalKeys, decodePresetCookie, dropPreset, encodePresetCookie, expandFinalKeys, pickedFinalKeys, presetLoadEdit, putPreset, type FinalPreset } from '@/lib/planner/final-presets'

const preset = (slot: number, giftKeys = ['final_9250', 'final_9273_plus', 'final_9301_plusplus']): FinalPreset =>
  ({ slot, name: '화상 ' + slot + '; "테스트"', giftKeys, updatedAt: '2026-09-25T01:00:00.000Z' })

describe('final gift presets', () => {
  it('keeps only picked final keys and round-trips the compact form', () => {
    expect(pickedFinalKeys(['start_1', 'observe_2', 'final_3', 'final_4_plus', 'x_final_5'])).toEqual(['final_3', 'final_4_plus'])
    expect(compactFinalKeys(preset(1).giftKeys)).toBe('9250,9273+,9301++')
    expect(expandFinalKeys('9250,9273+,9301++,bad,1+++')).toEqual(preset(1).giftKeys)
  })

  it('round-trips the cookie and ignores garbage', () => {
    const value = encodePresetCookie([preset(2), preset(1)])
    expect(value).not.toMatch(/[;, "]/)
    expect(decodePresetCookie(value)).toEqual([preset(1), preset(2)])
    expect(decodePresetCookie('%%%')).toEqual([])
    expect(decodePresetCookie(encodeURIComponent('[{"s":9,"n":"x","g":"1"}]'))).toEqual([])
  })

  it('refuses a cookie that would be too large instead of truncating', () => {
    const big = Array.from({ length: 60 }, (_, i) => 'final_' + (100000 + i) + '_plusplus')
    const five = [1, 2, 3, 4, 5].map(slot => ({ ...preset(slot, big), name: '가'.repeat(40) }))
    expect(() => encodePresetCookie(five)).toThrow('too_large')
  })

  it('puts, drops and loads slots', () => {
    const list = putPreset(putPreset([preset(3)], preset(1)), { ...preset(3), name: 'new' })
    expect(list.map(p => [p.slot, p.name])).toEqual([[1, preset(1).name], [3, 'new']])
    expect(dropPreset(list, 1).map(p => p.slot)).toEqual([3])
    expect(presetLoadEdit(['start_1', 'final_5', 'final_6_plus'], ['final_7', 'final_7', 'start_9'])).toEqual({ remove: ['final_5', 'final_6_plus'], add: ['final_7'] })
  })
})

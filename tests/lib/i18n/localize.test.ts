import { describe, expect, it } from 'vitest'
import { getLocalizedName, localizeRowName } from '@/lib/i18n/localize'

type Row = { name: string; name_en?: string | null; name_jp?: string | null }

// What the planner components wrote by hand before the helper existed.
const before = (row: Row, lang: 'ko' | 'en' | 'ja') => getLocalizedName({ name_kr: row.name, name_en: row.name_en, name_jp: row.name_jp }, lang)

describe('localizeRowName', () => {
  const full: Row = { name: '선물', name_en: 'Gift', name_jp: 'ギフト' }

  it('picks the name of the page language', () => {
    expect(localizeRowName(full, 'ko')).toBe('선물')
    expect(localizeRowName(full, 'en')).toBe('Gift')
    expect(localizeRowName(full, 'ja')).toBe('ギフト')
  })

  it('falls back to the Korean name when the translation is missing or empty', () => {
    for (const row of [{ name: '선물' }, { name: '선물', name_en: null, name_jp: null }, { name: '선물', name_en: '', name_jp: '' }]) {
      expect(localizeRowName(row, 'en')).toBe('선물')
      expect(localizeRowName(row, 'ja')).toBe('선물')
    }
  })

  it('gives the same result as the inline getLocalizedName call it replaces', () => {
    const rows: Row[] = [full, { name: '선물' }, { name: '선물', name_en: '', name_jp: 'ギフト' }, { name: '', name_en: 'Gift', name_jp: null }]
    for (const row of rows) for (const lang of ['ko', 'en', 'ja'] as const) expect(localizeRowName(row, lang)).toBe(before(row, lang))
  })
})

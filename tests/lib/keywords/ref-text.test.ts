import { describe, expect, it } from 'vitest'
import { keywordTextsFromRefs, type KeywordRefTexts } from '../../../lib/keywords/ref-text'

const ref = (over: Partial<KeywordRefTexts> = {}): KeywordRefTexts => ({
  name: '화상', name_en: 'Burn', name_jp: '火傷',
  description: '턴 종료 시 피해', description_en: 'At turn end, take damage', description_jp: 'ターン終了時にダメージ',
  ...over,
})
const meta = {
  name: '화상', game_id: 'Combustion',
  name_en: 'old Burn', name_jp: '旧火傷',
  description: '옛 설명', description_en: 'old text', description_jp: '旧説明',
}

describe('keyword texts read from the game text references', () => {
  it('shows the reference names and descriptions in every language, keeping the Korean name as the key', () => {
    const out = keywordTextsFromRefs(meta, { Combustion: ref() })
    expect(out).toEqual({
      name: '화상', game_id: 'Combustion',
      name_en: 'Burn', name_jp: '火傷',
      description: '턴 종료 시 피해', description_en: 'At turn end, take damage', description_jp: 'ターン終了時にダメージ',
    })
  })

  it('falls back to the keyword_meta column for each language where the reference text is empty', () => {
    const out = keywordTextsFromRefs(meta, { Combustion: ref({ name_en: null, description_jp: '   ', name_jp: '' }) })
    expect(out.name_en).toBe('old Burn')
    expect(out.name_jp).toBe('旧火傷')
    expect(out.description_jp).toBe('旧説明')
    expect(out.description_en).toBe('At turn end, take damage')
  })

  it('changes nothing without a game_id, with an unknown id, or without the reference table', () => {
    expect(keywordTextsFromRefs({ ...meta, game_id: null }, { Combustion: ref() })).toEqual({ ...meta, game_id: null })
    expect(keywordTextsFromRefs({ ...meta, game_id: undefined }, { Combustion: ref() })).toEqual({ ...meta, game_id: undefined })
    expect(keywordTextsFromRefs(meta, { Other: ref() })).toEqual(meta)
    expect(keywordTextsFromRefs(meta, null)).toEqual(meta)
    expect(keywordTextsFromRefs(meta, {})).toEqual(meta)
  })

  it('keeps the hand-written Korean description of 원호 공격 and 원호 방어, with the other languages from the reference', () => {
    for (const name of ['원호 공격', '원호 방어']) {
      const out = keywordTextsFromRefs({ ...meta, name, game_id: 'X' }, { X: ref({ name }) })
      expect(out.description).toBe('옛 설명')
      expect(out.description_en).toBe('At turn end, take damage')
      expect(out.description_jp).toBe('ターン終了時にダメージ')
    }
  })

  it('keeps the keyword_meta description (with its placeholder labels) when the reference text still holds a bare {0} slot', () => {
    const raw = ref({ description: '위력 {0} 만큼 피해', description_en: 'Deal {0:F1} damage', description_jp: 'ダメージ' })
    const out = keywordTextsFromRefs({ ...meta, description: '위력 {{potency}} 만큼 피해', description_en: 'Deal {{potency}} damage' }, { Combustion: raw })
    expect(out.description).toBe('위력 {{potency}} 만큼 피해')
    expect(out.description_en).toBe('Deal {{potency}} damage')
    expect(out.description_jp).toBe('ダメージ')
  })

  it('uses a reference text with a bare slot only when keyword_meta has nothing for that language', () => {
    const raw = ref({ description_en: 'Deal {0} damage' })
    const out = keywordTextsFromRefs({ ...meta, description_en: null }, { Combustion: raw })
    expect(out.description_en).toBe('Deal {0} damage')
  })

  it('shows a reference name as plain text, without the Unity tags the game puts in some names', () => {
    const out = keywordTextsFromRefs(meta, { Combustion: ref({
      name_en: 'The Middle - Vengeance Tattoo [<s>Great Brother</s>]',
      name_jp: '本国剣術[サ<size=50%>ル</size>]',
    }) })
    expect(out.name_en).toBe('The Middle - Vengeance Tattoo [Great Brother]')
    expect(out.name_jp).toBe('本国剣術[サル]')
  })

  it('uses keyword_meta\'s name when the reference name is only tags', () => {
    const out = keywordTextsFromRefs(meta, { Combustion: ref({ name_en: '<s></s>' }) })
    expect(out.name_en).toBe('old Burn')
  })

  it('trims the stray whitespace the game leaves around a description, like keyword_meta stores it', () => {
    const out = keywordTextsFromRefs(meta, { Combustion: ref({ description: '- 최대값 : 12 \n', description_en: '\n- Max 12  ' }) })
    expect(out.description).toBe('- 최대값 : 12')
    expect(out.description_en).toBe('- Max 12')
  })

  it('returns a new row and leaves other fields alone', () => {
    const row = { ...meta, icon_slug: 'burn', max_stack: 5 }
    const out = keywordTextsFromRefs(row, { Combustion: ref() })
    expect(out).not.toBe(row)
    expect(out.icon_slug).toBe('burn')
    expect(out.max_stack).toBe(5)
    expect(row.name_en).toBe('old Burn')
  })
})

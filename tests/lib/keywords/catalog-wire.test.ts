import { describe, expect, it } from 'vitest'
import { compactKeywordCatalog, expandKeywordCatalog } from '@/lib/keywords/catalog-wire'
import { getLocalizedKeywordIndex, type KeywordInfo } from '@/lib/keywords/catalog'

const CATALOG: Record<string, KeywordInfo> = {
  화상: { desc: '턴 종료 시 피해', maxStack: 99, iconSlug: 'burn', effectType: 'negative', gameId: 'Combustion', nameEn: 'Burn', nameJp: '火傷', descEn: 'Damage at turn end', descJp: 'ダメージ' },
  호흡: { desc: '크리티컬 확률 증가', iconSlug: 'poise', gameId: 'Breath', nameEn: 'Poise', nameJp: null, descEn: null, descJp: null },
  이름만: { desc: '', nameEn: null, nameJp: null, descEn: null, descJp: null },
}

describe('REQ-KEYWORDS-012 the layout catalogue carries only the page language', () => {
  it('REQ-KEYWORDS-012 drops descriptions, the other languages and (Korean) the game id', () => {
    const ko = compactKeywordCatalog(CATALOG, 'ko')
    expect(ko.화상).toEqual({ maxStack: 99, iconSlug: 'burn', effectType: 'negative' })
    expect(ko.이름만).toEqual({})
    expect(JSON.stringify(ko)).not.toMatch(/Burn|火傷|Combustion|턴 종료|Damage|ダメージ/)
  })

  it('REQ-KEYWORDS-012 keeps the English name and game id for English, the Japanese ones for Japanese', () => {
    expect(compactKeywordCatalog(CATALOG, 'en').화상).toEqual({ maxStack: 99, iconSlug: 'burn', effectType: 'negative', gameId: 'Combustion', nameEn: 'Burn' })
    expect(compactKeywordCatalog(CATALOG, 'ja').화상).toEqual({ maxStack: 99, iconSlug: 'burn', effectType: 'negative', gameId: 'Combustion', nameJp: '火傷' })
  })

  it('REQ-KEYWORDS-012 keeps every language name for the sections that search across languages', () => {
    expect(compactKeywordCatalog(CATALOG, 'all').화상).toMatchObject({ nameEn: 'Burn', nameJp: '火傷', gameId: 'Combustion' })
    expect(JSON.stringify(compactKeywordCatalog(CATALOG, 'all'))).not.toMatch(/턴 종료|Damage|ダメージ/)
  })

  it('REQ-KEYWORDS-012 fills the missing cells with the values the readers expect', () => {
    expect(expandKeywordCatalog(compactKeywordCatalog(CATALOG, 'en')).화상).toEqual({
      desc: '', maxStack: 99, iconSlug: 'burn', effectType: 'negative', gameId: 'Combustion', nameEn: 'Burn', nameJp: null, descEn: null, descJp: null,
    })
    expect(expandKeywordCatalog(compactKeywordCatalog(CATALOG, 'ko')).이름만).toEqual({ desc: '', nameEn: null, nameJp: null, descEn: null, descJp: null })
  })

  it('REQ-KEYWORDS-012 leaves an entry that is already complete as it is', () => {
    expect(expandKeywordCatalog(CATALOG).화상).toEqual(CATALOG.화상)
  })

  it('REQ-KEYWORDS-012 builds the same name index for the page language as the full catalogue', () => {
    for (const lang of ['ko', 'en', 'ja'] as const) {
      const slim = expandKeywordCatalog(compactKeywordCatalog(CATALOG, lang))
      expect(getLocalizedKeywordIndex(slim, lang)).toEqual(getLocalizedKeywordIndex(CATALOG, lang))
    }
  })
})

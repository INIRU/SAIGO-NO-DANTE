import { expect, it } from 'vitest'
import { keywordDescriptions } from '../../../lib/keywords/server-data'
import { compactKeywordCatalog } from '../../../lib/keywords/catalog-wire'
import type { KeywordInfo } from '../../../lib/keywords/catalog'

const catalog: Record<string, KeywordInfo> = {
  화상: { desc: '턴 종료 시 화상 위력만큼 피해', iconSlug: 'burn', sinAffinity: 'wrath', nameEn: 'Burn', nameJp: '火傷', descEn: 'At Turn End, take damage', descJp: null },
  호흡: { desc: '크리티컬 확률 증가', nameEn: 'Poise', nameJp: '呼吸', descEn: null, descJp: '会心率上昇' },
}

it('keeps names, icons and colours for every page but leaves descriptions to the tooltip request', () => {
  const slim = compactKeywordCatalog(catalog, 'all')
  expect(slim.화상).toEqual({ iconSlug: 'burn', sinAffinity: 'wrath', nameEn: 'Burn', nameJp: '火傷' })
  expect(JSON.stringify(slim)).not.toMatch(/피해|damage|会心/)
})

it('serves each description in the page language, falling back to Korean', () => {
  expect(keywordDescriptions(catalog, 'ko')).toEqual({ 화상: '턴 종료 시 화상 위력만큼 피해', 호흡: '크리티컬 확률 증가' })
  expect(keywordDescriptions(catalog, 'en')).toEqual({ 화상: 'At Turn End, take damage', 호흡: '크리티컬 확률 증가' })
  expect(keywordDescriptions(catalog, 'ja')).toEqual({ 화상: '턴 종료 시 화상 위력만큼 피해', 호흡: '会心率上昇' })
})

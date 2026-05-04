import { normalizeForStats, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { countGiftConditionAffiliations, normalizeGiftAffiliationLabel } from '@/lib/decks/keyword-rules'
import type { GiftData } from '@/lib/planner/types'

export type GiftConditionStatus = { level: 'warn' | 'unmet'; text: string }

export function getGiftActivationConditionStatus({
  gift,
  formationKeywordCounts,
  allKeywordCounts,
  formationAffiliationCounts = {},
  allAffiliationCounts = {},
}: {
  gift: Pick<GiftData, 'activation_condition'>
  formationKeywordCounts: Record<string, number>
  allKeywordCounts: Record<string, number>
  formationAffiliationCounts?: Record<string, number>
  allAffiliationCounts?: Record<string, number>
}): GiftConditionStatus | null {
  const cond = gift.activation_condition
  if (!cond || !cond.count) return null

  let formationHave = 0
  let allHave = 0
  let label = ''
  const countThemeKeyword = (counts: Record<string, number>, keyword: string): number => {
    const normalizedKeyword = normalizeThemeKeyword(keyword)
    return Object.entries(counts).reduce((sum, [rawKeyword, count]) => (
      normalizeForStats(rawKeyword) === normalizedKeyword ? sum + count : sum
    ), 0)
  }

  if (cond.type === 'keyword' && cond.keyword) {
    formationHave = countThemeKeyword(formationKeywordCounts, cond.keyword)
    allHave = countThemeKeyword(allKeywordCounts, cond.keyword)
    label = cond.keyword
  } else if (cond.type === 'multi_keyword' && cond.keywords) {
    formationHave = cond.keywords.reduce((sum, kw) => sum + countThemeKeyword(formationKeywordCounts, kw), 0)
    allHave = cond.keywords.reduce((sum, kw) => sum + countThemeKeyword(allKeywordCounts, kw), 0)
    label = cond.keywords.join('+')
  } else if (cond.type === 'affiliation') {
    const affiliations = cond.affiliations ?? (cond.affiliation ? [cond.affiliation] : [])
    formationHave = countGiftConditionAffiliations(formationAffiliationCounts, affiliations)
    allHave = countGiftConditionAffiliations(allAffiliationCounts, affiliations)
    label = affiliations.map(normalizeGiftAffiliationLabel).join('/')
  } else {
    return null
  }

  if (formationHave >= cond.count) return null
  if (allHave >= cond.count) return { level: 'warn', text: `${label} 편성 ${formationHave}/${cond.count}, 대기 포함 ${allHave}/${cond.count}` }
  return { level: 'unmet', text: `${label} 대기 포함 ${allHave}/${cond.count}` }
}

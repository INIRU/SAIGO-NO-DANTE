'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { type ActivationCondition } from '@/lib/data/sinners'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import type { SupportedLang } from '@/lib/i18n'
import { getLocalizedAffiliations } from '@/lib/i18n'

export type EgoGiftEntry = {
  name: string
  keyword: string
  grade: string
  image_url: string | null
  effect_base: string | null
  activation_condition: ActivationCondition | null
}

export type IdentitySlotForGifts = {
  slot_order: number
  identities: { keywords: string[] | null } | null
}

function computeActivatedGifts(
  formedSlots: IdentitySlotForGifts[],
  allEgoGifts: EgoGiftEntry[],
): EgoGiftEntry[] {
  const kwCounts: Record<string, number> = {}
  const affCounts: Record<string, number> = {}
  for (const slot of formedSlots) {
    const id_ = slot.identities
    if (id_?.keywords) {
      for (const kw of id_.keywords) kwCounts[kw] = (kwCounts[kw] ?? 0) + 1
    }
  }

  return allEgoGifts.filter(g => {
    const c = g.activation_condition
    if (!c) return false
    let current = 0
    if (c.type === 'keyword') {
      current = kwCounts[c.keyword!] ?? 0
    } else if (c.type === 'multi_keyword') {
      for (const kw of c.keywords!) current += kwCounts[kw] ?? 0
    } else if (c.type === 'affiliation') {
      if (c.affiliations) {
        for (const aff of c.affiliations) current += affCounts[aff] ?? 0
      } else {
        current = affCounts[c.affiliation!] ?? 0
      }
    }
    return current >= c.count
  })
}

const KW_ORDER = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격', '공통']

export default function DeckEgoGiftAccordion({
  filledSlots,
  allEgoGifts,
  open,
  onToggle,
}: {
  filledSlots: IdentitySlotForGifts[]
  allEgoGifts: EgoGiftEntry[]
  open: boolean
  onToggle: () => void
}) {
  const { getIconUrl } = useKeywordData()
  const keywords = useKeywords()
  const locale = useLocale() as SupportedLang
  const t = useTranslations('decks')
  const formedSlots = filledSlots.filter(s => s.slot_order !== 99)
  if (formedSlots.length === 0 || allEgoGifts.length === 0) return null

  const activated = computeActivatedGifts(formedSlots, allEgoGifts)
  if (activated.length === 0) return null

  const grouped: Record<string, EgoGiftEntry[]> = {}
  for (const g of activated) {
    ;(grouped[g.keyword] ??= []).push(g)
  }

  return (
    <div className="mb-3 rounded-lg overflow-hidden" style={{ background: '#120e09', border: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
        style={{ background: open ? 'rgba(200,144,10,0.04)' : 'transparent', borderBottom: open ? '1px solid rgba(32,20,8,0.7)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: open ? '#8a7040' : 'var(--text-tertiary)', letterSpacing: '0.12em' }}>
            {t('detail.egoGifts')}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#c8900a' }}>
            {activated.length}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none"
          style={{ color: open ? '#8a7040' : '#5a5065', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 flex flex-col gap-2" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {KW_ORDER.filter(kw => grouped[kw]).map(kw => (
            <div key={kw}>
              <div className="flex items-center gap-1.5 mb-1">
                {getIconUrl(kw) && (
                  <Image src={getIconUrl(kw)!} alt="" width={12} height={12} style={{ opacity: 0.7 }} />
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#8a7040', letterSpacing: '0.05em' }}>
                  {localizeDeckKeyword(kw, keywords[kw], locale)} ({grouped[kw].length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {grouped[kw].map(g => {
                  const c = g.activation_condition!
                  const affiliations = c.affiliations ?? (c.affiliation ? [c.affiliation] : [])
                  const condLabel = c.type === 'keyword' ? t('egoGifts.conditionKeyword', { keyword: localizeDeckKeyword(c.keyword!, keywords[c.keyword!], locale), count: c.count })
                    : c.type === 'multi_keyword' ? t('egoGifts.conditionMultiKeyword', { keywords: c.keywords!.map(kw => localizeDeckKeyword(kw, keywords[kw], locale)).join('+'), count: c.count })
                    : c.type === 'affiliation' ? t('egoGifts.conditionAffiliation', { affiliation: getLocalizedAffiliations(affiliations, locale).join('/'), count: c.count })
                    : t('egoGifts.conditionCount', { count: c.count })
                  return (
                    <div key={g.name} className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: 'rgba(200,144,10,0.06)' }}>
                      {g.image_url && (
                        <Image src={g.image_url} alt="" width={20} height={20} className="rounded" style={{ flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: '#c8a450', fontWeight: 600 }}>{g.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#8a8060', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>{condLabel}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#2a8a2a', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{t('egoGifts.on')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

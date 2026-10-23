'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import GiftCard from '@/components/ui/GiftCard'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { useFormatSkillDesc, resolveKeywordIconUrl } from '@/components/providers/KeywordProvider'
import { Link } from '@/lib/i18n/navigation'
import { SINNER_SLUGS } from '@/lib/constants/game'
import { getSinIconUrl, normalizeSin } from '@/lib/constants/sin'
import { getEgoGradeBannerUrl, getIdentityPortraitUrl } from '@/lib/utils/images'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { keywordDesc, keywordName, kt, useKeywordColor, type KeywordEntry } from './KeywordCard'
import { keywordTextAllowed } from '@/lib/keywords/plain-keywords'

export interface KeywordIdentity {
  id: string; name: string; name_kr: string; sinner_id: string
  name_en: string | null; name_jp: string | null
  keywords: string[] | null; rarity: number; game_id: string | null; folder_name: string | null
}
export interface KeywordEgo {
  id: string; name: string; name_kr: string | null; sinner_id: string
  name_en: string | null; name_jp: string | null
  grade: string; sin_affinity: string | null; keywords: string[] | null
  folder_name: string | null; image_url: string | null
}
export interface KeywordGift {
  name: string; keyword: string; grade: string; image_url: string | null
  effect_base: string | null; effect_plus: string | null; effect_plusplus: string | null
}

const sinnerRank = (id: string) => SINNER_SLUGS.indexOf(id)
const bySinner = <T extends { sinner_id: string }>(list: T[]) => [...list].sort((a, b) => sinnerRank(a.sinner_id) - sinnerRank(b.sinner_id))
const GRADE_RANK: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, EX: 6 }

const TILE = 'relative block overflow-hidden rounded-sm border border-[#2a2118] bg-[#100d08] transition-colors hover:border-[#5a4526] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]'

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="border-t border-[#2e2417] px-5 py-4">
      <div className="mb-2.5 flex min-h-7 items-center justify-between gap-3">
        <h3 className="font-[family-name:var(--font-heading)] text-[0.875rem] text-[#9c8b73]">{title}</h3>
        <span className="font-[family-name:var(--font-title)] text-[1.125rem] tabular-nums text-[#6a5a44]">{count}</span>
      </div>
      {children}
    </section>
  )
}

export default function KeywordModal({
  keyword: kw, categoryLabel, relatedIdentities, relatedEgos, relatedGifts, sinnerNameMap, onSelectGift, onClose, lang,
}: {
  keyword: KeywordEntry
  categoryLabel: string
  relatedIdentities: KeywordIdentity[]
  relatedEgos: KeywordEgo[]
  relatedGifts: KeywordGift[]
  sinnerNameMap: Record<string, string>
  onSelectGift: (gift: KeywordGift) => void
  onClose: () => void
  lang: SupportedLang
}) {
  const formatSkillDesc = useFormatSkillDesc()
  const tGift = useTranslations('giftDetail')
  const color = useKeywordColor(kw.name)
  const name = keywordName(kw, lang)
  const desc = kw.description ? keywordDesc(kw, lang) : ''
  const iconUrl = resolveKeywordIconUrl(kw.name, kw.icon_slug)
  const sin = normalizeSin(kw.sin_affinity)
  // The keyword's own gifts first, then gifts that only mention it; lower grades first inside each.
  const gifts = [...relatedGifts].sort((a, b) =>
    Number(b.keyword === kw.name) - Number(a.keyword === kw.name) || (GRADE_RANK[a.grade] ?? 9) - (GRADE_RANK[b.grade] ?? 9))
  const empty = relatedIdentities.length + relatedEgos.length + gifts.length === 0

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="40rem" title={name} sheet>
      <div className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl border border-[#2e2417] bg-[#17120c] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.6)] sm:max-h-[85vh] sm:rounded-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={tGift('close')}
          className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full text-[#9c8b73] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)]"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="overflow-y-auto overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <header className="flex items-center gap-4 px-5 pb-4 pr-14 pt-5">
            <span className="flex size-[4.5rem] shrink-0 items-center justify-center rounded bg-[#0d0b08] sm:size-20">
              {iconUrl && <KeywordIcon src={iconUrl} alt="" width={56} height={56} className="size-12 object-contain sm:size-14" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-pretty font-[family-name:var(--font-heading)] text-[1.3125rem] leading-[1.3]" style={{ color }}>{name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-[#9c8b73]">
                <span>{categoryLabel}</span>
                {kw.max_stack ? (
                  <span>{kt('keyword.maxStack', lang)} <span className="font-[family-name:var(--font-title)] text-[1rem] tabular-nums text-[#e8b030]">{kw.max_stack}</span></span>
                ) : null}
                {sin && (
                  <span className="inline-flex items-center gap-1">
                    <Image src={getSinIconUrl(sin)} alt="" width={16} height={16} className="size-4" />
                    {kt(`sin.${sin}`, lang)}
                  </span>
                )}
              </div>
            </div>
          </header>

          {desc && (
            <div className="whitespace-pre-line border-t border-[#2e2417] px-5 py-4 text-[0.875rem] leading-[1.75] text-[#d8ccb4]">
              {formatSkillDesc(desc, '#d8ccb4', undefined, keywordTextAllowed(kw.name), { highlightValues: color, matchPlainKeywords: true, keywordText: true })}
            </div>
          )}

          {relatedIdentities.length > 0 && (
            <Section title={kt('keyword.related.identities', lang)} count={relatedIdentities.length}>
              <ul className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.25rem, 1fr))' }}>
                {bySinner(relatedIdentities).map(id => {
                  const label = `${getLocalizedName(id, lang)} ${sinnerNameMap[id.sinner_id] ?? ''}`.trim()
                  const src = getIdentityPortraitUrl(id.sinner_id, id.folder_name, id.game_id, false)
                  return (
                    <li key={id.id}>
                      <Link href={`/sinners/${id.sinner_id}/identities/${id.id}`} onClick={onClose} title={label} aria-label={label} className={`${TILE} aspect-square`}>
                        {src && <Image src={src} alt="" fill sizes="3.5rem" className="object-cover object-top" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {relatedEgos.length > 0 && (
            <Section title={kt('keyword.related.ego', lang)} count={relatedEgos.length}>
              <ul className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.25rem, 1fr))' }}>
                {bySinner(relatedEgos).map(ego => {
                  const label = `${getLocalizedName({ name_kr: ego.name_kr ?? ego.name, name_en: ego.name_en, name_jp: ego.name_jp }, lang)} ${sinnerNameMap[ego.sinner_id] ?? ''}`.trim()
                  return (
                    <li key={ego.id}>
                      <Link href={`/sinners/${ego.sinner_id}/ego/${ego.id}`} onClick={onClose} title={label} aria-label={label} className={`${TILE} aspect-square`}>
                        {ego.image_url && <Image src={ego.image_url} alt="" fill sizes="3.5rem" className="object-cover" />}
                        <Image src={getEgoGradeBannerUrl(ego.grade)} alt="" width={185} height={71} className="absolute bottom-0.5 left-0.5 h-3 w-auto" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {gifts.length > 0 && (
            <Section title={kt('keyword.related.gifts', lang)} count={gifts.length}>
              <div className="grid gap-x-2 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(4.25rem, 1fr))' }}>
                {gifts.map(g => <GiftCard key={g.name} gift={g} onClick={() => onSelectGift(g)} />)}
              </div>
            </Section>
          )}

          {empty && (
            <p className="border-t border-[#2e2417] px-5 py-8 text-center text-[0.8125rem] text-[#9c8b73]">{kt('keyword.related.empty', lang)}</p>
          )}
          <div className="h-2 sm:h-1" />
        </div>
      </div>
    </BaseModal>
  )
}

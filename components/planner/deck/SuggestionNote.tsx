'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { getLocalizedAffiliation, getLocalizedName } from '@/lib/i18n/localize'
import { getIdentityPortraitUrl } from '@/lib/utils/images'
import { reasonParts, type Archetype, type Suggestion } from '@/lib/discovery/suggestion-types'
import type { SupportedLang } from '@/lib/i18n/types'
import type { PlannerDeckIdentity } from './PlannerDeckSelection'

const MAX_PARTNERS = 3

/** The readable reason of a suggestion on one line ("출혈 · 거미집"), or '' when it has none. */
export function useReasonLabel() {
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const t = useTranslations('suggestions')
  const tSin = useTranslations('sin')
  return (codes: readonly string[] | undefined) => reasonParts(codes).map(part => {
    if (part.kind === 'keyword') return localizeDeckKeyword(part.value, keywords[part.value], locale)
    if (part.kind === 'faction') return getLocalizedAffiliation(part.value, locale)
    return t('sinResonance', { sin: tSin(part.value as never) })
  }).join(' · ')
}

/** "출혈 덱": the archetype the chosen identities add up to, for the title of the suggestion group (the affiliation when no keyword stands out); '' when neither does. */
export function useArchetypeLabel() {
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const t = useTranslations('suggestions')
  return (archetype: Archetype | null | undefined) => {
    const names = archetype?.keywords.length
      ? archetype.keywords.slice(0, 2).map(keyword => localizeDeckKeyword(keyword, keywords[keyword], locale))
      : (archetype?.factions ?? []).slice(0, 1).map(faction => getLocalizedAffiliation(faction, locale))
    return names.length ? t('archetype', { name: names.join(', ') }) : ''
  }
}

/** A face of a partner identity: a round crop of its portrait, with the name on hover, focus, or tap. Gold ring when it is already on the board. */
function PartnerFace({ identity, chosen }: { identity: PlannerDeckIdentity; chosen: boolean }) {
  const locale = useLocale() as SupportedLang
  const [open, setOpen] = useState(false)
  const name = getLocalizedName({ name_kr: identity.name_kr ?? identity.name ?? '', name_en: identity.name_en, name_jp: identity.name_jp }, locale)
  const art = getIdentityPortraitUrl(identity.sinner_id, identity.folder_name ?? null, identity.game_id ?? null, true)
  return (
    <span className="idnote__face" data-partner-face data-chosen={chosen} data-open={open || undefined}>
      <button type="button" className="relative h-7 w-7 overflow-hidden rounded-full" aria-label={name} aria-expanded={open} onClick={() => setOpen(value => !value)} onBlur={() => setOpen(false)}>
        {art && <Image src={art} alt="" fill sizes="28px" quality={50} style={{ objectFit: 'cover', objectPosition: '50% 0', transform: 'scale(1.9)', transformOrigin: '50% 12%' }} />}
      </button>
      <span role="tooltip" className="idnote__name">{name}</span>
    </span>
  )
}

/**
 * Under a suggested card: up to three faces of who it goes well with and, in one line, why. Both are left out when the
 * suggestion carries no partners or reasons.
 */
export default function SuggestionNote({ suggestion, identityOf }: { suggestion: Suggestion; identityOf: (id: string) => PlannerDeckIdentity | undefined }) {
  const t = useTranslations('suggestions')
  const reasonLabel = useReasonLabel()
  const partners = (suggestion.partners ?? []).flatMap(partner => { const identity = identityOf(partner.id); return identity ? [{ identity, chosen: partner.chosen }] : [] }).slice(0, MAX_PARTNERS)
  const reason = reasonLabel(suggestion.reasons)
  if (partners.length === 0 && !reason) return null
  return (
    <div className="idnote" data-suggestion-note>
      {partners.length > 0 && (
        <div className="idnote__partners">
          <span className="idnote__label">{t('pairsWith')}</span>
          {partners.map(({ identity, chosen }) => <PartnerFace key={identity.id} identity={identity} chosen={chosen} />)}
        </div>
      )}
      {reason && <p className="idnote__reason" title={reason}>{reason}</p>}
      <style jsx global>{`
        .idnote { margin-top: 0.375rem; min-width: 0; container-type: inline-size; }
        .idnote__partners { display: flex; flex-wrap: nowrap; align-items: center; min-width: 0; }
        .idnote__label { margin-right: 0.375rem; color: var(--text-muted); font-size: 0.6875rem; line-height: 1; white-space: nowrap; }
        .idnote__face { position: relative; display: inline-flex; flex: none; }
        .idnote__face + .idnote__face { margin-left: -0.375rem; }
        .idnote__face:hover, .idnote__face:focus-within, .idnote__face[data-open] { z-index: 2; }
        @container (max-width: 8rem) { .idnote__label { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); } }
        .idnote__face button { position: relative; width: 1.75rem; height: 1.75rem; padding: 0; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 0 0 2px var(--bg-deep); border-radius: 999px; background: var(--bg-deep); cursor: pointer; }
        .idnote__face[data-chosen='true'] button { border-color: var(--gold-light); }
        .idnote__face button:focus-visible { outline: 2px solid var(--gold-light); outline-offset: 1px; }
        .idnote__name {
          position: absolute; bottom: calc(100% + 0.375rem); left: 50%; z-index: 30; transform: translateX(-50%); max-width: 9rem; padding: 0.25rem 0.5rem; overflow: hidden;
          border: 1px solid #5a4526; border-radius: 0.25rem; background: #1d160d; color: var(--text-primary); font-size: 0.8125rem; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap;
          opacity: 0; pointer-events: none; transition: opacity 125ms ease-out;
        }
        .idnote__face[data-open] .idnote__name { opacity: 1; }
        @media (hover: hover) and (pointer: fine) { .idnote__face:hover .idnote__name { opacity: 1; } }
        .idnote__reason { margin-top: 0.25rem; overflow: hidden; color: var(--text-secondary); font-size: 0.8125rem; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
        @media (prefers-reduced-motion: reduce) { .idnote__name { transition: none; } }
      `}</style>
    </div>
  )
}

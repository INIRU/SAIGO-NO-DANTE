'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Plus, Search, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import ThemePackCard from '@/components/ui/ThemePackCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import GiftCatalog, { giftKeywordIcon, toCatalogGift, useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedAffiliation } from '@/lib/i18n/localize'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import { getAffiliationIconUrl } from '@/lib/constants/affiliation-icons'
import { SINNER_SLUGS } from '@/lib/constants/game'
import type { BoardFacets } from '@/hooks/useBoardFacets'

export type FacetKind = 'affiliation' | 'ego' | 'gift' | 'theme'
type Named = { name: string; name_kr?: string | null; name_en?: string | null; name_jp?: string | null }

const localizedName = (item: Named, lang: SupportedLang) =>
  (lang === 'en' ? item.name_en : lang === 'ja' ? item.name_jp : null) || item.name_kr || item.name

/** Display name and thumbnail of a selected option, for the sidebar list and removable chips. */
export function facetOption(kind: FacetKind, id: string, facets: BoardFacets | undefined, lang: SupportedLang): { label: string; image: string | null } {
  if (kind === 'affiliation') return { label: getLocalizedAffiliation(id, lang), image: getAffiliationIconUrl(id) }
  const item = kind === 'ego' ? facets?.egos.find(ego => ego.id === id)
    : kind === 'gift' ? facets?.gifts.find(gift => String(gift.game_id) === id)
      : facets?.themes.find(theme => String(theme.id) === id)
  return { label: item ? localizedName(item, lang) : id, image: item?.image_url ?? null }
}

function Count({ value }: { value: number }) {
  const t = useTranslations('boardFacets')
  return <p className="mt-1 text-center text-[0.75rem] text-[#7f7364]">{t('postCount', { count: value })}</p>
}

function NameSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative mb-4 block max-w-[24rem]">
      <Search size={14} aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7f7364]" />
      <input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="min-h-10 w-full rounded border border-[#2e2417] bg-[#0d0b08] pl-8 pr-3 text-[0.9375rem] text-[#e8dcc8] outline-none placeholder:text-[#6a6058] focus:border-[#5a4526]" />
    </label>
  )
}

/**
 * A board filter's picker: affiliations, E.G.O cards, the gift catalog or theme pack cards, each with how many posts use
 * it. Opened from the board sidebar like the identity picker; choices apply as they are clicked.
 */
export function FacetPickerModal({ kind, facets, selected, onToggle, onClose }: {
  kind: FacetKind | null
  facets: BoardFacets | undefined
  selected: readonly string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const t = useTranslations('boardFacets')
  const rootT = useTranslations()
  const lang = useLocale() as SupportedLang
  const [query, setQuery] = useState('')
  const [sinner, setSinner] = useState<string | null>(null)
  const giftFilters = useGiftCatalogFilters()
  const catalogGifts = useMemo(() => (facets?.gifts ?? []).map(gift => toCatalogGift(gift as unknown as GiftData)), [facets])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const match = (...names: (string | null | undefined)[]) => {
    const text = query.trim().toLocaleLowerCase()
    return !text || names.some(name => name?.toLocaleLowerCase().includes(text))
  }
  const sinnerName = (id: string) => rootT(`sinner.${id}` as Parameters<typeof rootT>[0])

  let body: ReactNode = null
  if (kind === 'affiliation') body = (
    <>
      <NameSearch value={query} onChange={setQuery} placeholder={t('searchAffiliation')} />
      <div className="flex flex-wrap gap-1.5">
        {(facets?.affiliations ?? []).filter(item => match(item.key, getLocalizedAffiliation(item.key, lang))).map(item => {
          const active = selectedSet.has(item.key)
          return (
            <button key={item.key} type="button" aria-pressed={active} onClick={() => onToggle(item.key)}
              className="flex min-h-10 items-center gap-2 rounded px-3 text-[0.9375rem] font-semibold transition-colors"
              style={{ background: active ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)', color: active ? 'var(--gold)' : 'var(--deck-filter-text-muted)' }}>
              {getAffiliationIconUrl(item.key) && <Image src={getAffiliationIconUrl(item.key)!} alt="" width={24} height={24} className="h-6 w-6 shrink-0" />}
              {getLocalizedAffiliation(item.key, lang)}
              <span className="font-[family-name:var(--font-title)] text-[1rem] font-normal leading-none opacity-70">{item.count}</span>
            </button>
          )
        })}
      </div>
    </>
  )
  if (kind === 'ego') {
    const sinners = SINNER_SLUGS.filter(id => (facets?.egos ?? []).some(ego => ego.sinner_id === id))
    body = (
      <>
        <div className="mb-4 flex flex-wrap gap-1" role="group" aria-label={t('sinner')}>
          {sinners.map(id => {
            const active = sinner === id
            return (
              <button key={id} type="button" aria-pressed={active} onClick={() => setSinner(active ? null : id)} title={sinnerName(id)}
                className="grid h-10 w-10 place-items-center rounded transition-colors"
                style={{ background: active ? 'var(--deck-filter-surface-active)' : 'var(--deck-filter-surface-muted)' }}>
                <Image src={getSinnerLogoUrl(id)} alt={sinnerName(id)} width={28} height={28} className="h-7 w-7 object-contain" style={{ opacity: active ? 1 : 0.5 }} />
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
          {(facets?.egos ?? []).filter(ego => !sinner || ego.sinner_id === sinner).map(ego => (
            <div key={ego.id} className="min-w-0">
              <EgoDisplayCard ego={ego} name={localizedName(ego, lang)} sinnerId={ego.sinner_id} lang={lang} selected={selectedSet.has(ego.id)} onClick={() => onToggle(ego.id)} />
              <Count value={ego.count} />
            </div>
          ))}
        </div>
      </>
    )
  }
  if (kind === 'gift') body = (
    <div style={{ '--gift-catalog-bg': '#17120c', '--gift-catalog-sticky-top': '0px', '--gift-catalog-min-h': '0px' } as React.CSSProperties}>
      <GiftCatalog compact gifts={catalogGifts} getGiftKeywordIcon={giftKeywordIcon} filters={giftFilters} selectedIds={selectedSet}
        onGiftClick={(gift: EgoGift) => onToggle(gift.id)} />
    </div>
  )
  if (kind === 'theme') body = (
    <>
      <NameSearch value={query} onChange={setQuery} placeholder={t('searchTheme')} />
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5 md:grid-cols-7">
        {(facets?.themes ?? []).filter(theme => match(theme.name, theme.name_en, theme.name_jp)).map(theme => (
          <div key={theme.id} className="min-w-0">
            <ThemePackCard theme={theme} sizes="7rem" imageSurface="bare" isSelected={selectedSet.has(String(theme.id))} onClick={() => onToggle(String(theme.id))} />
            <Count value={theme.count} />
          </div>
        ))}
      </div>
    </>
  )

  return (
    <BaseModal open={kind !== null} onClose={() => { setQuery(''); onClose() }} title={kind ? t(kind) : ''} maxWidth="64rem">
      <div className="flex h-[min(80dvh,56rem)] flex-col rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#2e2417] px-5 py-3">
          <h2 className="font-[family-name:var(--font-heading)] text-[1.125rem] text-[#e8dcc8]">
            {kind && t(kind)}
            {selected.length > 0 && <span className="ml-2 font-[family-name:var(--font-title)] text-[1.125rem] text-[#e8b030]">{selected.length}</span>}
          </h2>
          <button type="button" onClick={() => { setQuery(''); onClose() }} aria-label={t('close')}
            className="grid h-10 w-10 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[#e8dcc8]">
            <X size={18} />
          </button>
        </div>
        {/* 위쪽 여백은 안쪽에: 기프트 목록의 고정 도구줄이 스크롤 상자 맨 위에 붙어 그 위로 내용이 비치지 않는다 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5"><div className="pt-5">{body}</div></div>
      </div>
    </BaseModal>
  )
}

/** Sidebar section body: what is picked (click to remove) and a button that opens the picker. */
export function FacetSelection({ kind, facets, selected, onRemove, onOpen }: {
  kind: FacetKind
  facets: BoardFacets | undefined
  selected: readonly string[]
  onRemove: (id: string) => void
  onOpen: () => void
}) {
  const t = useTranslations('boardFacets')
  const lang = useLocale() as SupportedLang
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      {selected.map(id => {
        const { label, image } = facetOption(kind, id, facets, lang)
        return (
          <button key={id} type="button" onClick={() => onRemove(id)} aria-label={t('remove', { label })}
            className="flex min-h-9 items-center gap-2 rounded px-2 text-left transition-colors hover:bg-white/5"
            style={{ background: 'var(--deck-filter-surface-active)', color: 'var(--gold)', fontSize: 'var(--deck-filter-control-text)' }}>
            {image && <span className={`relative h-6 w-6 shrink-0 overflow-hidden ${kind === 'ego' ? 'rounded-full' : kind === 'theme' ? 'rounded-sm' : ''}`}>
              <Image src={image} alt="" fill sizes="24px" className={kind === 'gift' || kind === 'affiliation' ? 'object-contain' : 'object-cover'} />
            </span>}
            <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
            <X size={13} aria-hidden="true" className="shrink-0 opacity-70" />
          </button>
        )
      })}
      <button type="button" onClick={onOpen}
        className="flex min-h-9 items-center justify-center gap-1.5 rounded transition-colors hover:bg-white/5"
        style={{ background: 'var(--deck-filter-surface-muted)', color: 'var(--deck-filter-text-muted)', fontSize: 'var(--deck-filter-control-text)', fontWeight: 600 }}>
        <Plus size={14} aria-hidden="true" />{t(selected.length ? 'pickMore' : 'pick')}
      </button>
    </div>
  )
}


/** The facet sections of a board sidebar, styled like its other collapsible sections; each opens FacetPickerModal. */
export function FacetSections({ kinds, facets, selections, onRemove, onOpen }: {
  kinds: readonly FacetKind[]
  facets: BoardFacets | undefined
  selections: Record<FacetKind, string[]>
  onRemove: (kind: FacetKind, id: string) => void
  onOpen: (kind: FacetKind) => void
}) {
  const t = useTranslations('boardFacets')
  const [closed, setClosed] = useState<Set<FacetKind>>(() => new Set())
  return <>
    {kinds.map(kind => {
      const open = !closed.has(kind)
      const count = selections[kind].length
      const Icon = open ? ChevronDown : ChevronRight
      return (
        <section key={kind}>
          <button type="button" aria-expanded={open}
            onClick={() => setClosed(current => { const next = new Set(current); if (next.has(kind)) next.delete(kind); else next.add(kind); return next })}
            className="flex w-full items-center gap-2 text-left transition-colors hover:bg-white/[0.025]"
            style={{ minHeight: 'var(--deck-filter-control-min)', color: count ? 'var(--gold)' : '#666', fontFamily: 'var(--font-body)', fontSize: 'var(--deck-filter-label-text)' }}>
            <Icon size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
            <span className="min-w-0 flex-1 truncate">{t(kind)}</span>
            {count > 0 && <span style={{ background: 'rgba(200,144,10,0.18)', color: 'var(--gold)', minWidth: '1.375rem', padding: '0.0625rem 0.4375rem', borderRadius: '999rem', fontSize: 'var(--deck-filter-control-text)', lineHeight: 1.2, textAlign: 'center' }}>{count}</span>}
          </button>
          {open && <FacetSelection kind={kind} facets={facets} selected={selections[kind]} onRemove={id => onRemove(kind, id)} onOpen={() => onOpen(kind)} />}
        </section>
      )
    })}
  </>
}

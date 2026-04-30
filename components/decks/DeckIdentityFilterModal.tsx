'use client'

import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { Identity } from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'
import BaseModal from '@/components/ui/BaseModal'

export type DeckFilterSinner = {
  id: string
  name_kr: string
  order_num: number
}

export type DeckFilterIdentity = Identity & {
  sinner?: DeckFilterSinner | null
}

interface DeckIdentityFilterModalProps {
  open: boolean
  sinner: DeckFilterSinner | null
  identities: DeckFilterIdentity[]
  selectedIdentityIds: Set<string>
  onToggleIdentity: (identityId: string) => void
  onClose: () => void
}

export default function DeckIdentityFilterModal({
  open,
  sinner,
  identities,
  selectedIdentityIds,
  onToggleIdentity,
  onClose,
}: DeckIdentityFilterModalProps) {
  const locale = useLocale()
  const t = useTranslations('decks.identityFilter')
  const rootT = useTranslations()
  const sinnerName = sinner ? rootT(`sinner.${sinner.id}` as Parameters<typeof rootT>[0]) : ''
  const localizedIdentityName = (identity: DeckFilterIdentity) => {
    if (locale === 'en' && identity.name_en) return identity.name_en
    if (locale === 'ja' && identity.name_jp) return identity.name_jp
    return identity.name_kr
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      maxWidth="46rem"
      padding="calc(env(safe-area-inset-top) + 0.75rem) calc(env(safe-area-inset-right) + 0.75rem) calc(env(safe-area-inset-bottom) + 0.75rem) calc(env(safe-area-inset-left) + 0.75rem)"
      title={sinner ? t('title', { sinner: sinnerName }) : t('fallbackTitle')}
      description={t('description')}
    >
      <div
        className="max-h-[82dvh] overflow-hidden rounded-md"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid rgba(200,144,10,0.18)',
          boxShadow: '0 1rem 2rem rgba(0,0,0,0.34)',
        }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
          style={{ borderBottom: '1px solid rgba(200,144,10,0.14)' }}
        >
          <div className="min-w-0 flex-1">
            <p
              style={{ color: 'var(--deck-filter-text-dim)', fontFamily: 'var(--font-heading)', fontSize: 'var(--deck-filter-control-text)', letterSpacing: '0.08em', lineHeight: 1.2 }}
            >
              IDENTITY FILTER
            </p>
            <h2
              className="truncate"
              style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.35 }}
            >
              {sinner ? t('heading', { order: String(sinner.order_num).padStart(2, '0'), sinner: sinnerName }) : t('fallbackTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex shrink-0 items-center justify-center rounded transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
            style={{ width: 'var(--deck-filter-touch-min)', height: 'var(--deck-filter-touch-min)', color: '#9a938a', cursor: 'pointer' }}
            aria-label={t('close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(82dvh-4.25rem)] overflow-x-hidden overflow-y-auto px-3 py-5 overscroll-contain scrollbar-thin sm:px-5 sm:py-6">
          <style>{`
            .deck-identity-filter-card{transform:translate3d(0,0,0);transition:transform 180ms cubic-bezier(.22,1,.36,1),filter 180ms cubic-bezier(.22,1,.36,1)}
            .deck-identity-filter-card:is(:hover,:focus-visible){transform:translate3d(0,-0.1875rem,0);filter:brightness(1.08)}
            .deck-identity-filter-card:active{transform:translate3d(0,-0.0625rem,0);filter:brightness(1.02)}
            @media (prefers-reduced-motion:reduce){.deck-identity-filter-card{transition:filter 120ms ease}.deck-identity-filter-card:is(:hover,:focus-visible),.deck-identity-filter-card:active{transform:none}}
          `}</style>
          {identities.length > 0 ? (
            <div
              className="grid gap-x-3 gap-y-12 overflow-visible pb-10 sm:gap-x-5 sm:gap-y-14"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(var(--deck-identity-picker-cell-min, 6.25rem), 1fr))' }}
            >
              {identities.map(identity => {
                const selected = selectedIdentityIds.has(identity.id)
                return (
                  <button
                    key={identity.id}
                    onClick={() => onToggleIdentity(identity.id)}
                    className="deck-identity-filter-card relative overflow-visible p-0 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                    style={{
                      minHeight: 'var(--deck-filter-touch-min)',
                      background: 'transparent',
                      border: '0',
                      cursor: 'pointer',
                    }}
                    aria-pressed={selected}
                    aria-label={selected ? t('remove', { identity: localizedIdentityName(identity) }) : t('add', { identity: localizedIdentityName(identity) })}
                  >
                    <IdentityCard identity={identity} compact selected={selected} disableHoverEffects />
                  </button>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--deck-filter-text-soft)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              {t('loadFailed')}
            </p>
          )}
        </div>
      </div>
    </BaseModal>
  )
}

'use client'

import Image from 'next/image'
import QuietImage from '@/components/ui/QuietImage'
import { useTranslations } from 'next-intl'
import { useDeferredValue, type ReactNode } from 'react'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import { localizeGiftKeyword } from '@/components/ui/GiftDetailModal'
import { ThemePackModalGrid, ThemePackModalPill, ThemePackModalShell } from '@/components/ui/ThemePackModal'
import type { EgoGift, EgoGiftTheme, MdEvent } from '@/components/mirror-dungeon/types'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'

interface ThemeModalProps {
  lang: SupportedLang
  theme: EgoGiftTheme
  themeGifts: EgoGift[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
  events?: MdEvent[]
  choiceCountByEventId?: Map<number, number>
}

const DUNGEON_COLORS: Record<string, string> = { '익스트림': '#e06a5a', '평행중첩': '#c09ae0', '하드': '#e89030', '노말': '#bfae92' }

function GiftSection({ title, count, tone = 'muted', icon, hint, children }: {
  title: string
  count: number
  tone?: 'reward' | 'gold' | 'muted'
  icon?: ReactNode
  hint?: string
  children: ReactNode
}) {
  const color = tone === 'reward' ? '#e06a5a' : tone === 'gold' ? '#e8b030' : '#bfae92'
  return (
    <section
      className={tone === 'reward' ? 'mb-5 rounded-md border p-3.5' : 'mb-5'}
      style={tone === 'reward' ? { borderColor: 'rgba(155,44,35,0.75)', background: 'rgba(155,44,35,0.1)' } : undefined}
    >
      <div className="mb-2.5 flex items-center gap-2">
        {icon}
        <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', color }}>{title}</h4>
        <span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.0625rem', lineHeight: 1, color: '#6a5a44' }}>{count}</span>
      </div>
      {hint && <p className="-mt-1 mb-3" style={{ fontSize: '0.8125rem', color: '#9c8b73' }}>{hint}</p>}
      {children}
    </section>
  )
}

export default function ThemeModal({
  lang,
  theme,
  themeGifts,
  getGiftKeywordIcon,
  onClose,
  onSelectGift,
  events,
  choiceCountByEventId,
}: ThemeModalProps) {
  const tp = useTranslations('themePackDetail')
  // The first commit paints the header, rewards and exclusives; the shared pool (up to ~190 cards) renders
  // in a background pass right after, so opening the modal never waits on it.
  const showPool = useDeferredValue(true, false)
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }
  const getGiftCardData = (gift: EgoGift) => ({
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang),
  })
  const getEventDisplayName = (event: MdEvent) => {
    if (event.name) {
      return getLocalizedName({ name_kr: event.name, name_en: event.name_en, name_jp: event.name_jp }, lang)
    }
    const desc = lang === 'en'
      ? event.desc_text_en ?? event.desc_text
      : lang === 'ja'
      ? event.desc_text_jp ?? event.desc_text
      : event.desc_text
    return desc ? desc.split('\n')[0].slice(0, 30) : t('mirrorDungeon.event.fallbackTitle')
  }

  const isHidden = theme.is_hidden === true
  const hiddenRate = isHidden && typeof theme.hidden_rate === 'number' ? theme.hidden_rate * 100 : null

  // Each gift is listed once: clear reward, then pack-exclusive, then the shared pool by keyword.
  const rewardIds = new Set(theme.fixed_reward_gift_ids ?? [])
  const specificIds = new Set(theme.specific_ego_gift_ids)
  const rewardGifts = themeGifts.filter(g => g.game_id != null && rewardIds.has(g.game_id))
  const exclusiveGifts = themeGifts.filter(g => g.game_id != null && specificIds.has(g.game_id) && !rewardIds.has(g.game_id))
  const sharedGifts = themeGifts.filter(g => g.game_id == null || (!specificIds.has(g.game_id) && !rewardIds.has(g.game_id)))
  const byKeyword: Record<string, EgoGift[]> = {}
  for (const g of sharedGifts) (byKeyword[g.keyword] ??= []).push(g)
  const keywordGroups = Object.entries(byKeyword).sort((a, b) => b[1].length - a[1].length)

  const allEventIds = new Set((events ?? []).map(ev => ev.id))
  const themeEvents = (events ?? []).filter(ev => {
    const numericParentId = String(ev.id).length === 8 ? Math.floor(ev.id / 100) : null
    const isNestedEvent = ev.variant_of != null || (numericParentId != null && allEventIds.has(numericParentId))
    return !isNestedEvent && ev.theme_ids?.includes(theme.id) && (ev.theme_ids?.length ?? 0) <= 5
  })

  const displayName = getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)
  const dungeonDisplayMap: Record<string, string> = {
    '익스트림': t('mirrorDungeon.tier.extreme'),
    '평행중첩': t('mirrorDungeon.tier.parallel'),
    '하드': t('mirrorDungeon.tier.hard'),
    '노말': t('mirrorDungeon.tier.normal'),
  }
  const getDiffLabel = (diff: string) => diff === 'extreme' ? t('mirrorDungeon.tier.extreme') : diff === 'hard' ? t('mirrorDungeon.tier.hard') : t('mirrorDungeon.tier.normal')
  const getFloorText = (floors: unknown): string => {
    if (floors === '전체') return t('mirrorDungeon.theme.allFloors')
    if (Array.isArray(floors)) {
      return lang === 'ko' ? floors.join(', ') + '층' : lang === 'ja' ? floors.join(', ') + '階' : 'F' + floors.join(', F')
    }
    return String(floors)
  }

  const diff = theme.difficulty || 'normal'
  const posterSrc = getThemePackVisualConfig(theme.id) ? getThemePackCompositeImageUrl(theme.id) : theme.image_url
  const floorEntries = Object.entries(theme.floor_info ?? {})

  return (
    <ThemePackModalShell
      title={displayName}
      onClose={onClose}
      closeLabel={t('mirrorDungeon.theme.close')}
      maxWidth="48rem"
      poster={posterSrc ? (
        <span className="relative block w-full" style={{ aspectRatio: '416/684', filter: 'drop-shadow(0 0.75rem 1.25rem rgba(0,0,0,0.6))' }}>
          <QuietImage src={posterSrc} alt="" fill sizes="(max-width: 640px) 88px, 136px" className="object-contain" {...blurPlaceholder(posterSrc)} />
        </span>
      ) : undefined}
      eyebrow={isHidden ? <ThemePackModalPill tone="purple">{tp('hidden')}</ThemePackModalPill> : null}
      meta={
        <>
          {!isHidden && <ThemePackModalPill tone={diff === 'extreme' ? 'red' : diff === 'hard' ? 'gold' : 'neutral'}>{getDiffLabel(diff)}</ThemePackModalPill>}
          {hiddenRate !== null && <ThemePackModalPill tone="purple">{tp('hiddenRate', { rate: hiddenRate.toFixed(2) })}</ThemePackModalPill>}
          <ThemePackModalPill>{tp('giftCount', { count: themeGifts.length })}</ThemePackModalPill>
          {floorEntries.length > 0 && (
            <dl className="mt-1 flex w-full flex-wrap gap-x-4 gap-y-1" style={{ fontSize: '0.8125rem' }}>
              <dt className="sr-only">{tp('floors')}</dt>
              {floorEntries.map(([dungeon, floors]) => (
                <dd key={dungeon} className="flex items-baseline gap-1.5">
                  <span style={{ color: DUNGEON_COLORS[dungeon] ?? '#bfae92', fontFamily: 'var(--font-heading)' }}>{dungeonDisplayMap[dungeon] ?? dungeon}</span>
                  <span style={{ color: '#d8ccb4' }}>{getFloorText(floors)}</span>
                </dd>
              ))}
            </dl>
          )}
        </>
      }
    >
      <div className="border-t pt-4" style={{ borderColor: '#2e2417' }}>
        {rewardGifts.length > 0 && (
          <GiftSection title={tp('clearReward')} count={rewardGifts.length} tone="reward" hint={tp('clearRewardHint')}>
            <ThemePackModalGrid minColumnWidth="4.75rem">
              {rewardGifts.map(g => <GiftCard key={g.id} gift={getGiftCardData(g)} onClick={() => onSelectGift(g)} />)}
            </ThemePackModalGrid>
          </GiftSection>
        )}

        {exclusiveGifts.length > 0 && (
          <GiftSection title={tp('exclusive')} count={exclusiveGifts.length} tone="gold">
            <ThemePackModalGrid minColumnWidth="4.25rem">
              {exclusiveGifts.map(g => <GiftCard key={g.id} gift={getGiftCardData(g)} onClick={() => onSelectGift(g)} />)}
            </ThemePackModalGrid>
          </GiftSection>
        )}

        {keywordGroups.length > 0 && !showPool && <div aria-hidden="true" style={{ minHeight: '24rem' }} />}
        {keywordGroups.length > 0 && showPool && (
          <section className="mb-5">
            <h4 className="mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', color: '#bfae92' }}>
              {tp('common')}
              <span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.0625rem', lineHeight: 1, color: '#6a5a44' }}>{sharedGifts.length}</span>
            </h4>
            {keywordGroups.map(([kw, kwGifts]) => {
              const iconUrl = getGiftKeywordIcon(kw)
              const label = localizeGiftKeyword(kw, lang)
              return (
                <div key={kw} className="mb-4 border-l pl-3" style={{ borderColor: '#2e2417', contentVisibility: 'auto', containIntrinsicSize: 'auto 12rem' }}>
                  <div className="mb-2 flex items-center gap-1.5">
                    {iconUrl && <Image src={iconUrl} alt="" width={16} height={16} style={{ width: '1rem', height: '1rem' }} />}
                    <span style={{ color: '#9c8b73', fontSize: '0.8125rem' }}>{label}</span>
                    <span className="tabular-nums" style={{ color: '#6a5a44', fontSize: '0.8125rem' }}>{kwGifts.length}</span>
                  </div>
                  <ThemePackModalGrid>
                    {kwGifts.map(g => <GiftCard key={g.id} gift={getGiftCardData(g)} onClick={() => onSelectGift(g)} />)}
                  </ThemePackModalGrid>
                </div>
              )
            })}
          </section>
        )}

        {themeEvents.length > 0 && (
          <section className="border-t pt-4" style={{ borderColor: '#2e2417' }}>
            <h4 className="mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', color: '#bfae92' }}>
              {tp('events')}
              <span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.0625rem', lineHeight: 1, color: '#6a5a44' }}>{themeEvents.length}</span>
            </h4>
            <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 13rem), 1fr))' }}>
              {themeEvents.map(ev => {
                const name = getEventDisplayName(ev)
                const choices = choiceCountByEventId?.get(ev.id) ?? 0
                return (
                  <li key={ev.id} className="flex items-center gap-2.5 rounded-sm border p-1.5" style={{ borderColor: '#2e2417', background: 'var(--bg-deep)' }}>
                    {ev.image_url && (
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm">
                        <QuietImage src={ev.image_url} alt="" fill sizes="44px" className="object-cover" {...blurPlaceholder(ev.image_url)} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="line-clamp-2 block" style={{ color: '#d8ccb4', fontSize: '0.8125rem', lineHeight: 1.35 }}>{name}</span>
                      {choices > 0 && <span className="block" style={{ color: '#9c8b73', fontSize: '0.6875rem' }}>{tp('choices', { count: choices })}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </ThemePackModalShell>
  )
}

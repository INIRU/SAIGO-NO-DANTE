'use client'

import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import {
  ThemePackModalGrid,
  ThemePackModalPill,
  ThemePackModalSection,
  ThemePackModalShell,
} from '@/components/ui/ThemePackModal'
import type { EgoGift, EgoGiftTheme, MdEvent } from '@/components/mirror-dungeon/types'
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

const KEYWORD_TRANSLATION_KEYS: Record<string, string> = {
  '화상': 'mirrorDungeon.filter.combustion',
  '출혈': 'mirrorDungeon.filter.laceration',
  '진동': 'mirrorDungeon.filter.vibration',
  '파열': 'mirrorDungeon.filter.burst',
  '침잠': 'mirrorDungeon.filter.sinking',
  '호흡': 'mirrorDungeon.filter.breath',
  '충전': 'mirrorDungeon.filter.charge',
  '참격': 'mirrorDungeon.filter.slash',
  '관통': 'mirrorDungeon.filter.pierce',
  '타격': 'mirrorDungeon.filter.blunt',
  '공통': 'mirrorDungeon.filter.common',
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
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }
  const getKeywordLabel = (keyword: string) => {
    const key = KEYWORD_TRANSLATION_KEYS[keyword]
    return key ? t(key) : keyword
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
  const hiddenRate = isHidden && typeof theme.hidden_rate === 'number'
    ? theme.hidden_rate * 100
    : null

  const specificIds = new Set(theme.specific_ego_gift_ids)
  const fixedRewardIds = new Set(theme.fixed_reward_gift_ids ?? [])
  const fixedRewardGifts = isHidden && fixedRewardIds.size > 0
    ? themeGifts.filter(g => g.game_id != null && fixedRewardIds.has(g.game_id))
    : []
  const exclusiveGifts = themeGifts.filter(g => g.game_id != null && specificIds.has(g.game_id))
  const sharedGifts = themeGifts.filter(g => !g.game_id || !specificIds.has(g.game_id))

  const byKeyword: Record<string, EgoGift[]> = {}
  for (const g of sharedGifts) {
    if (!byKeyword[g.keyword]) byKeyword[g.keyword] = []
    byKeyword[g.keyword].push(g)
  }

  const allEventIds = new Set((events ?? []).map(ev => ev.id))
  const themeEvents = (events ?? []).filter(ev => {
    const numericParentId = String(ev.id).length === 8
      ? Math.floor(ev.id / 100)
      : null
    const isNestedEvent =
      ev.variant_of != null ||
      (numericParentId != null && allEventIds.has(numericParentId))

    return (
      !isNestedEvent &&
      ev.theme_ids?.includes(theme.id) &&
      (ev.theme_ids?.length ?? 0) <= 5
    )
  })

  const displayName = getLocalizedName(
    { name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp },
    lang
  )

  // Localized display name for dungeon keys (floor_info uses Korean keys as identifiers)
  const dungeonDisplayMap: Record<string, string> = {
    '익스트림': t('mirrorDungeon.tier.extreme'),
    '평행중첩': t('mirrorDungeon.tier.parallel'),
    '하드': t('mirrorDungeon.tier.hard'),
    '노말': t('mirrorDungeon.tier.normal'),
  }

  // Localized difficulty label
  const getDiffLabel = (diff: string) => {
    if (diff === 'extreme') return t('mirrorDungeon.tier.extreme')
    if (diff === 'hard') return t('mirrorDungeon.tier.hard')
    return t('mirrorDungeon.tier.normal')
  }

  // Localized floor text for floor_info values
  const getFloorText = (floors: unknown): string => {
    if (floors === '전체') return t('mirrorDungeon.theme.allFloors')
    if (Array.isArray(floors)) {
      return floors
        .map((f: number) =>
          lang === 'ko' ? `${f}층` : `${t('mirrorDungeon.theme.floor')}${f}`
        )
        .join(', ')
    }
    return String(floors)
  }

  const headerMeta = (
    <>
      {!isHidden && (() => {
        const diff = theme.difficulty || 'normal'
        const tone = diff === 'extreme' ? 'red' : diff === 'hard' ? 'gold' : 'neutral'
        return <ThemePackModalPill tone={tone}>{getDiffLabel(diff)}</ThemePackModalPill>
      })()}
      {isHidden && hiddenRate !== null && (
        <ThemePackModalPill tone="purple">
          {t('mirrorDungeon.theme.appearanceRate')}: {hiddenRate.toFixed(2)}%
        </ThemePackModalPill>
      )}
      <ThemePackModalPill>{themeGifts.length}{t('mirrorDungeon.theme.giftCountSuffix')}</ThemePackModalPill>
      {exclusiveGifts.length > 0 && (
        <ThemePackModalPill tone="gold">★{exclusiveGifts.length} {t('mirrorDungeon.theme.exclusiveBadge')}</ThemePackModalPill>
      )}
    </>
  )

  return (
    <ThemePackModalShell
      title={displayName}
      onClose={onClose}
      imageUrl={theme.image_url}
      imageAlt={displayName}
      closeLabel={t('mirrorDungeon.theme.close')}
      maxWidth="48rem"
      eyebrow={isHidden ? <ThemePackModalPill tone="purple">{t('mirrorDungeon.theme.hiddenBadge')}</ThemePackModalPill> : null}
      meta={headerMeta}
    >
            {/* 출현 정보 + 키워드 분포 */}
            <div className="flex flex-wrap gap-4 mt-4 mb-5">
              {theme.floor_info && Object.keys(theme.floor_info).length > 0 && (
                <div className="flex-1 min-w-[14rem]">
                  <p
                    className="text-[0.6875rem] font-bold mb-2"
                    style={{ color: '#666', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}
                  >
                    {t('mirrorDungeon.theme.appearance')}
                  </p>
                  <div className="space-y-1">
                    {Object.entries(theme.floor_info).map(([dungeon, floors]) => {
                      const dColor =
                        dungeon === '익스트림'
                          ? '#e04040'
                          : dungeon === '평행중첩'
                          ? '#b478dc'
                          : dungeon === '하드'
                          ? '#e89030'
                          : '#a0a090'
                      const floorText = getFloorText(floors)
                      return (
                        <div key={dungeon} className="flex items-center gap-2">
                          <span
                            className="inline-block w-16 text-right"
                            style={{ color: dColor, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                          >
                            {dungeonDisplayMap[dungeon] ?? dungeon}
                          </span>
                          <span style={{ color: '#555', fontSize: '0.8125rem' }}>—</span>
                          <span style={{ color: '#bbb', fontSize: '0.8125rem' }}>{floorText}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* 키워드 분포 */}
              <div className="flex-1 min-w-[10rem]">
                <p
                  className="text-[0.6875rem] font-bold mb-2"
                  style={{ color: '#666', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em' }}
                >
                  {t('mirrorDungeon.theme.keywordDist')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(byKeyword)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 6)
                    .map(([kw, kwGifts]) => {
                      const iconUrl = getGiftKeywordIcon(kw)
                      const keywordLabel = getKeywordLabel(kw)
                      return (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          {iconUrl && (
                            <Image
                              src={iconUrl}
                              alt={keywordLabel}
                              width={14}
                              height={14}
                              style={{ width: '0.875rem', height: '0.875rem' }}
                            />
                          )}
                          <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{keywordLabel}</span>
                          <span style={{ color: '#555', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                            {kwGifts.length}
                          </span>
                        </span>
                      )
                    })}
                </div>
              </div>
            </div>

            <div
              style={{
                height: '1px',
                background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent 60%)',
                marginBottom: '1.25rem',
              }}
            />

            {isHidden && fixedRewardGifts.length > 0 && (
              <ThemePackModalSection title={t('mirrorDungeon.theme.fixedReward')} count={fixedRewardGifts.length} icon="◆" tone="purple">
                <ThemePackModalGrid>
                  {fixedRewardGifts.map(g => (
                    <GiftCard key={g.id} gift={getGiftCardData(g)} onClick={() => onSelectGift(g)} />
                  ))}
                </ThemePackModalGrid>
                <div
                  className="mt-4"
                  style={{ height: '1px', background: 'linear-gradient(90deg, rgba(144,112,176,0.3), transparent)' }}
                />
              </ThemePackModalSection>
            )}

            {/* 등장 이벤트 */}
            {themeEvents.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>◇</span>
                  <span className="font-serif font-medium" style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>
                    {t('mirrorDungeon.theme.relatedEvents')}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    ({themeEvents.length})
                  </span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))' }}>
                  {themeEvents.map(ev => {
                    const eventDisplayName = getEventDisplayName(ev)
                    return (
                      <div
                        key={ev.id}
                        className="overflow-hidden rounded-lg"
                        style={{
                          background: '#1a1714',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {ev.image_url && (
                          <div className="relative w-full aspect-square overflow-hidden">
                            <ImageWithFallback
                              src={ev.image_url}
                              alt={eventDisplayName}
                              fill
                              fallbackType="default"
                              sizes="8rem"
                              className="object-cover"
                              style={{ opacity: 0.8 }}
                            />
                          </div>
                        )}
                        <div className="px-2 py-1.5">
                          <div
                            className="font-serif font-bold leading-tight"
                            style={{ color: '#ddd', fontSize: '0.6875rem' }}
                          >
                            {eventDisplayName}
                          </div>
                          {(choiceCountByEventId?.get(ev.id) ?? 0) > 0 && (
                            <div style={{ color: '#666', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', marginTop: '0.125rem' }}>
                              {choiceCountByEventId?.get(ev.id) ?? 0}{t('mirrorDungeon.theme.choiceCount')}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div
                  className="mt-4"
                  style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent)' }}
                />
              </div>
            )}

            {/* 전용 기프트 */}
            {exclusiveGifts.length > 0 && (
              <ThemePackModalSection title={t('mirrorDungeon.theme.exclusiveGifts')} count={exclusiveGifts.length} icon="★">
                <ThemePackModalGrid>
                  {exclusiveGifts.map(g => (
                    <GiftCard key={g.id} gift={getGiftCardData(g)} onClick={() => onSelectGift(g)} />
                  ))}
                </ThemePackModalGrid>
                <div
                  className="mt-4"
                  style={{ height: '1px', background: 'linear-gradient(90deg, var(--gold-dim), transparent)' }}
                />
              </ThemePackModalSection>
            )}

            {/* 키워드별 그룹 */}
            {Object.entries(byKeyword).map(([kw, kwGifts]) => {
              const iconUrl = getGiftKeywordIcon(kw)
              const keywordLabel = getKeywordLabel(kw)
              return (
                <div key={kw} className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    {iconUrl && (
                      <Image
                        src={iconUrl}
                        alt={keywordLabel}
                        width={16}
                        height={16}
                        style={{ width: '1rem', height: '1rem' }}
                      />
                    )}
                    <span
                      className="font-serif font-medium"
                      style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}
                    >
                      {keywordLabel}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({kwGifts.length})</span>
                  </div>
                  <ThemePackModalGrid>
                    {kwGifts.map(g => (
                      <GiftCard key={g.id} gift={getGiftCardData(g)} onClick={() => onSelectGift(g)} />
                    ))}
                  </ThemePackModalGrid>
                </div>
              )
            })}
    </ThemePackModalShell>
  )
}

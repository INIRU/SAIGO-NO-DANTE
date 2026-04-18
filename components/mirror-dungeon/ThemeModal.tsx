'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { useLocale } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/mirror-dungeon/GiftCard'
import type { EgoGift, EgoGiftTheme, MdEvent } from '@/components/mirror-dungeon/types'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'

interface ThemeModalProps {
  theme: EgoGiftTheme
  themeGifts: EgoGift[]
  getGiftKeywordIcon: (keyword: string) => string | null
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
  events?: MdEvent[]
  choiceCountByEventId?: Map<number, number>
}

export default function ThemeModal({
  theme,
  themeGifts,
  getGiftKeywordIcon,
  onClose,
  onSelectGift,
  events,
  choiceCountByEventId,
}: ThemeModalProps) {
  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
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

  const themeEvents = (events ?? []).filter(ev =>
    ev.theme_ids?.includes(theme.id) && (ev.theme_ids?.length ?? 0) <= 5
  )

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

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="48rem" padding="1rem" title="테마 상세">
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxHeight: '85vh',
          borderRadius: '0.75rem',
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.12)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.08), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="absolute top-3 right-3 z-20 p-1.5 rounded-full transition-colors hover:bg-white/10"
            style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
          >
            <X size={18} />
          </button>

          {/* 배너 헤더 */}
          <div className="relative overflow-hidden" style={{ height: theme.image_url ? '10rem' : '5rem' }}>
            {theme.image_url && (
              <>
                <ImageWithFallback
                  src={theme.image_url}
                  alt={displayName}
                  fill
                  fallbackType="theme"
                  sizes="(max-width: 768px) 100vw, 48rem"
                  className="object-cover object-center"
                  style={{ opacity: 0.4 }}
                />
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.6) 50%, rgba(19,17,16,0.3) 100%)' }}
                />
              </>
            )}
            {!theme.image_url && (
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(200,144,10,0.05) 0%, transparent 100%)' }}
              />
            )}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
              {isHidden && (
                <div className="mb-1.5">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-bold"
                    style={{
                      background: 'rgba(144,112,176,0.2)',
                      border: '1px solid rgba(144,112,176,0.4)',
                      color: '#b090d0',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {t('mirrorDungeon.theme.hiddenBadge')}
                  </span>
                </div>
              )}
              <h3
                className="font-serif text-xl md:text-2xl font-bold"
                style={{ color: '#e8d8c0', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
              >
                {displayName}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {!isHidden && (() => {
                  const diff = theme.difficulty || 'normal'
                  const label = getDiffLabel(diff)
                  const color = diff === 'extreme' ? '#e04040' : diff === 'hard' ? '#e89030' : '#999'
                  const bg =
                    diff === 'extreme'
                      ? 'rgba(224,64,64,0.2)'
                      : diff === 'hard'
                      ? 'rgba(232,144,48,0.2)'
                      : 'rgba(255,255,255,0.08)'
                  return (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold"
                      style={{ background: bg, color, fontFamily: 'var(--font-mono)' }}
                    >
                      {label}
                    </span>
                  )
                })()}
                {isHidden && hiddenRate !== null && (
                  <span
                    className="px-2 py-0.5 rounded text-[0.6875rem]"
                    style={{
                      background: 'rgba(144,112,176,0.12)',
                      color: '#b090d0',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {t('mirrorDungeon.theme.appearanceRate')}: {hiddenRate.toFixed(2)}%
                  </span>
                )}
                <span style={{ color: '#888', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                  {themeGifts.length}{t('mirrorDungeon.theme.giftCountSuffix')}
                </span>
                {exclusiveGifts.length > 0 && (
                  <span style={{ color: 'var(--gold)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                    ★{exclusiveGifts.length} {t('mirrorDungeon.theme.exclusiveBadge')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
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
                      return (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          {iconUrl && (
                            <Image
                              src={iconUrl}
                              alt={kw}
                              width={14}
                              height={14}
                              style={{ width: '0.875rem', height: '0.875rem' }}
                            />
                          )}
                          <span style={{ color: '#bbb', fontSize: '0.75rem' }}>{kw}</span>
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

            {/* 고정 보상 (히든 테마팩 전용) */}
            {isHidden && fixedRewardGifts.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span style={{ color: '#b090d0', fontSize: '0.875rem' }}>◆</span>
                  <span
                    className="font-serif font-medium"
                    style={{ color: '#b090d0', fontSize: '0.875rem' }}
                  >
                    {t('mirrorDungeon.theme.fixedReward')}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    ({fixedRewardGifts.length})
                  </span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))' }}>
                  {fixedRewardGifts.map(g => (
                    <GiftCard key={g.id} gift={g} onClick={() => onSelectGift(g)} />
                  ))}
                </div>
                <div
                  className="mt-4"
                  style={{ height: '1px', background: 'linear-gradient(90deg, rgba(144,112,176,0.3), transparent)' }}
                />
              </div>
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
                  {themeEvents.map(ev => (
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
                            alt={ev.name ?? ''}
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
                          {ev.name
                            ? getLocalizedName(
                                { name_kr: ev.name, name_en: ev.name_en, name_jp: ev.name_jp },
                                lang
                              )
                            : ev.name}
                        </div>
                        {(choiceCountByEventId?.get(ev.id) ?? 0) > 0 && (
                          <div style={{ color: '#666', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', marginTop: '0.125rem' }}>
                            {choiceCountByEventId?.get(ev.id) ?? 0}{t('mirrorDungeon.theme.choiceCount')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-4"
                  style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.2), transparent)' }}
                />
              </div>
            )}

            {/* 전용 기프트 */}
            {exclusiveGifts.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>★</span>
                  <span className="font-serif font-medium" style={{ color: 'var(--gold)', fontSize: '0.875rem' }}>
                    {t('mirrorDungeon.theme.exclusiveGifts')}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    ({exclusiveGifts.length})
                  </span>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))' }}>
                  {exclusiveGifts.map(g => (
                    <GiftCard key={g.id} gift={g} onClick={() => onSelectGift(g)} />
                  ))}
                </div>
                <div
                  className="mt-4"
                  style={{ height: '1px', background: 'linear-gradient(90deg, var(--gold-dim), transparent)' }}
                />
              </div>
            )}

            {/* 키워드별 그룹 */}
            {Object.entries(byKeyword).map(([kw, kwGifts]) => {
              const iconUrl = getGiftKeywordIcon(kw)
              return (
                <div key={kw} className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    {iconUrl && (
                      <Image
                        src={iconUrl}
                        alt={kw}
                        width={16}
                        height={16}
                        style={{ width: '1rem', height: '1rem' }}
                      />
                    )}
                    <span
                      className="font-serif font-medium"
                      style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}
                    >
                      {kw}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>({kwGifts.length})</span>
                  </div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))' }}>
                    {kwGifts.map(g => (
                      <GiftCard key={g.id} gift={g} onClick={() => onSelectGift(g)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

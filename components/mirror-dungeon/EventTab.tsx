'use client'

import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import Dropdown from '@/components/ui/Dropdown'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'

interface EventTabProps {
  events: MdEvent[]
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  choicesByEventId: Map<number, MdEventChoice[]>
  eventSearch: string
  setEventSearch: (v: string) => void
  eventThemeFilter: string
  setEventThemeFilter: (v: string) => void
  eventCategoryFilter: string
  setEventCategoryFilter: (v: string) => void
  onSelectEvent: (event: MdEvent) => void
}

export default function EventTab({
  events,
  giftByGameId,
  themes,
  choicesByEventId,
  eventSearch,
  setEventSearch,
  eventThemeFilter,
  setEventThemeFilter,
  eventCategoryFilter,
  setEventCategoryFilter,
  onSelectEvent,
}: EventTabProps) {
  const locale = useLocale()
  const lang = locale as SupportedLang
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const { filteredEvents, totalCount } = useMemo(() => {
    // events prop includes ALL events (root + variants + children) for FK chain traversal in EventModal.
    // The card grid only shows root events:
    // 1. Hide variant events (variant_of !== null)
    // 2. Hide child events referenced via next_event_id in any choice
    const childEventIds = new Set<number>()
    for (const choices of choicesByEventId.values()) {
      for (const c of choices) {
        if (c.next_event_id != null) childEventIds.add(c.next_event_id)
      }
    }
    // Additional child detection: 8-digit IDs that are children of 6-digit parents
    for (const ev of events) {
      const idStr = String(ev.id)
      if (idStr.length === 8) {
        const parentId = Math.floor(ev.id / 100)
        if (events.some(e => e.id === parentId)) {
          childEventIds.add(ev.id)
        }
      }
    }
    const rootEvents = events.filter(ev => ev.variant_of === null && !childEventIds.has(ev.id))

    const q = eventSearch.trim().toLowerCase()
    const filtered = q
      ? rootEvents.filter(ev => {
          if (ev.name?.toLowerCase().includes(q) || ev.desc_text?.toLowerCase().includes(q)) return true
          if (choicesByEventId.get(ev.id)?.some(c =>
            c.message?.toLowerCase().includes(q) || c.message_desc?.toLowerCase().includes(q)
          )) return true
          if (ev.gift_ids?.some(gid => {
            const g = giftByGameId.get(gid)
            return g && g.name.toLowerCase().includes(q)
          })) return true
          return false
        })
      : rootEvents

    const themeFiltered = eventThemeFilter
      ? filtered.filter(ev => ev.theme_ids?.includes(Number(eventThemeFilter)))
      : filtered

    const categoryFiltered = eventCategoryFilter
      ? themeFiltered.filter(ev => ev.category === eventCategoryFilter)
      : themeFiltered

    return { filteredEvents: categoryFiltered, totalCount: rootEvents.length }
  }, [events, eventSearch, eventThemeFilter, eventCategoryFilter, giftByGameId, choicesByEventId])

  return (
    <>
      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-[24rem]">
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#888',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder={t('mirrorDungeon.event.search')}
            value={eventSearch}
            onChange={e => setEventSearch(e.target.value)}
            className="w-full"
            style={{
              padding: '0.5625rem 2rem 0.5625rem 2.375rem',
              background: 'rgba(200,144,10,0.03)',
              border: '1px solid rgba(200,144,10,0.14)',
              borderRadius: '0.625rem',
              color: '#d8c8a0',
              outline: 'none',
              fontSize: '0.8125rem',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(200,144,10,0.45)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200,144,10,0.06), inset 0 1px 3px rgba(0,0,0,0.3)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(200,144,10,0.14)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {eventSearch && (
            <button
              onClick={() => setEventSearch('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(200,144,10,0.5)',
                cursor: 'pointer',
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(200,144,10,0.9)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,144,10,0.5)' }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <Dropdown
          value={eventThemeFilter}
          options={[
            { value: '', label: t('mirrorDungeon.event.allThemes') },
            ...themes
              .filter(th => !th.is_hidden)
              .sort((a, b) => a.id - b.id)
              .map(th => ({
                value: String(th.id),
                label: getLocalizedName({ name_kr: th.name, name_en: th.name_en, name_jp: th.name_jp }, lang),
              })),
          ]}
          onChange={setEventThemeFilter}
          prefix={t('mirrorDungeon.event.themePrefix')}
          defaultValue=""
          minWidth={140}
        />
        <Dropdown
          value={eventCategoryFilter}
          options={[
            { value: '', label: t('mirrorDungeon.event.allCategories') },
            { value: 'NORMAL', label: t('mirrorDungeon.event.normal') },
            { value: 'SEASONAL', label: t('mirrorDungeon.event.seasonal') },
            { value: 'GLOBAL_EVENT_HEAL', label: t('mirrorDungeon.event.vending') },
          ]}
          onChange={setEventCategoryFilter}
          prefix={t('mirrorDungeon.event.categoryPrefix')}
          defaultValue=""
          minWidth={120}
        />
        <span
          style={{
            color: 'rgba(200,144,10,0.45)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          {eventSearch || eventThemeFilter || eventCategoryFilter
            ? `${filteredEvents.length} / ${totalCount}`
            : `${totalCount}${lang === 'ko' ? '건' : ''}`}
        </span>
      </div>

      {/* ── Card grid ──────────────────────────────────────────────────────── */}
      {/*
        position: relative + zIndex: 0 creates a stacking context so that
        child card hover z-index stays isolated within the grid
      */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8"
        style={{ position: 'relative', zIndex: 0 }}
      >
        <style>{`
          .ev-card { transition: border-color 0.28s ease, box-shadow 0.28s ease, transform 0.28s ease; }
          .ev-card:hover { border-color: rgba(200,144,10,0.55) !important; box-shadow: 0 0 0 1px rgba(200,144,10,0.2), 0 0.625rem 2rem rgba(0,0,0,0.55), 0 0 1.5rem rgba(200,144,10,0.12) !important; transform: translateY(-0.1875rem) !important; }
          .ev-card:hover .ev-img { transform: scale(1.08); opacity: 0.82; }
          .ev-card:hover .ev-img-overlay { opacity: 1; }
          .ev-card:hover .ev-title { color: #f0e0c0 !important; }
          .ev-card:hover .ev-accent-line { opacity: 1; }
          .ev-card:hover .ev-corner-glow { opacity: 1; }
          .ev-img { transition: transform 0.4s ease, opacity 0.28s ease; }
          .ev-img-overlay { transition: opacity 0.28s ease; }
          .ev-accent-line { transition: opacity 0.28s ease; }
          .ev-corner-glow { transition: opacity 0.28s ease; }
        `}</style>

        {filteredEvents.map((ev, evIdx) => {
          const evGifts = (ev.gift_ids || []).map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
          const title = ev.name || (ev.desc_text ? ev.desc_text.split('\n')[0].slice(0, 30) : `${t('mirrorDungeon.event.fallbackTitle')} #${ev.id}`)
          const hasImage = Boolean(ev.image_url)
          const optCount = choicesByEventId.get(ev.id)?.length ?? 0

          return (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev)}
              className="ev-card group text-left overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1e1b17 0%, #171410 60%, #121008 100%)',
                border: '1px solid rgba(255,255,255,0.065)',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 0.25rem 0.75rem rgba(0,0,0,0.35)',
              }}
            >
              {/* ── Image area 3:4 ratio ────────────────────────────────── */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '1/1', flexShrink: 0 }}
              >
                {hasImage ? (
                  <>
                    <ImageWithFallback
                      src={ev.image_url!}
                      alt=""
                      fill
                      fallbackType="default"
                      sizes="(max-width: 640px) 50vw, 20vw"
                      className="ev-img object-cover"
                      style={{ opacity: 0.62 }}
                      loading={evIdx < 4 ? 'eager' : 'lazy'}
                    />
                    {/* Rich gradient — deep bottom, soft vignette edges */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(to top, #171410 0%, rgba(23,20,16,0.88) 28%, rgba(23,20,16,0.25) 60%, rgba(13,11,8,0.45) 100%)',
                      }}
                    />
                    {/* Hover shimmer overlay */}
                    <div
                      className="ev-img-overlay absolute inset-0 pointer-events-none"
                      style={{
                        opacity: 0,
                        background:
                          'linear-gradient(135deg, rgba(200,144,10,0.07) 0%, transparent 50%, rgba(200,144,10,0.04) 100%)',
                      }}
                    />
                    {/* Top-left ambient glow */}
                    <div
                      className="ev-corner-glow absolute top-0 left-0 pointer-events-none"
                      style={{
                        width: '70%',
                        height: '50%',
                        opacity: 0,
                        background:
                          'radial-gradient(ellipse at top left, rgba(200,144,10,0.1) 0%, transparent 65%)',
                      }}
                    />
                  </>
                ) : (
                  /* No-image placeholder */
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(200,144,10,0.07) 0%, rgba(255,255,255,0.01) 50%, rgba(200,144,10,0.04) 100%)',
                    }}
                  >
                    <div
                      style={{
                        width: '2.75rem',
                        height: '2.75rem',
                        border: '1px solid rgba(200,144,10,0.18)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 1.5rem rgba(200,144,10,0.08) inset',
                      }}
                    >
                      <span
                        style={{
                          color: 'rgba(200,144,10,0.35)',
                          fontSize: '1.125rem',
                          fontFamily: 'var(--font-serif)',
                          lineHeight: 1,
                        }}
                      >
                        ◈
                      </span>
                    </div>
                  </div>
                )}

                {/* Option count badge — top right */}
                {optCount > 0 && (
                  <div
                    className="absolute top-1.5 right-1.5"
                    style={{
                      padding: '0.125rem 0.4375rem',
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '0.3125rem',
                      fontSize: '0.5rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'rgba(200,144,10,0.7)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.6,
                    }}
                  >
                    {optCount}{t('mirrorDungeon.event.choices')}
                  </div>
                )}
              </div>

              {/* ── Text area ──────────────────────────────────────────── */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                  padding: '0.625rem 0.6875rem 0.6875rem',
                }}
              >
                <p
                  className="ev-title font-serif font-medium leading-snug line-clamp-2"
                  style={{
                    color: '#ddd0b0',
                    fontSize: '0.75rem',
                    minHeight: '2.1rem',
                    transition: 'color 0.2s',
                  }}
                >
                  {title}
                </p>

                {/* Bottom meta row */}
                <div
                  style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.375rem',
                  }}
                >
                  {evGifts.length > 0 && (
                    <span
                      style={{
                        color: '#c8900a',
                        fontSize: '0.5625rem',
                        fontFamily: 'var(--font-mono)',
                        background: 'rgba(200,144,10,0.09)',
                        border: '1px solid rgba(200,144,10,0.22)',
                        borderRadius: '0.25rem',
                        padding: '0.09375rem 0.34375rem',
                        letterSpacing: '0.03em',
                        lineHeight: 1.6,
                      }}
                    >
                      {t('mirrorDungeon.event.gifts')} {evGifts.length}{lang === 'ko' ? '종' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom gold accent line — reveals on hover */}
              <div
                className="ev-accent-line absolute bottom-0 left-0 right-0 pointer-events-none"
                style={{
                  height: '0.125rem',
                  background:
                    'linear-gradient(90deg, rgba(200,144,10,0.55), rgba(200,144,10,0.2) 55%, transparent)',
                  opacity: 0,
                  borderRadius: '0 0 0.75rem 0.75rem',
                }}
              />

              {/* Left edge micro-accent always visible */}
              <div
                className="absolute top-0 left-0 bottom-0 pointer-events-none"
                style={{
                  width: '0.125rem',
                  background:
                    'linear-gradient(to bottom, transparent 0%, rgba(200,144,10,0.2) 40%, rgba(200,144,10,0.08) 100%)',
                  borderRadius: '0.75rem 0 0 0.75rem',
                }}
              />
            </button>
          )
        })}
      </div>
    </>
  )
}

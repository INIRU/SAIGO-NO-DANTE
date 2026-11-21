'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { eventCheckSins, groupEventChoices } from '@/features/mirror-dungeon/lib/event-flow'
import { colorizeEventText } from '@/features/mirror-dungeon/lib/event-text'
import { getRootEvents } from '@/lib/utils/event-catalog'
import { Search, X } from 'lucide-react'
import styles from './EventTab.module.css'
import GiftArtwork from '@/components/ui/GiftArtwork'
import Dropdown from '@/components/ui/Dropdown'
import QuietImage from '@/components/ui/QuietImage'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice } from '@/features/mirror-dungeon/types'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { useTranslations } from 'next-intl'
import { getSinIconUrl } from '@/lib/constants/sin'

interface EventTabProps {
  lang: SupportedLang
  events: MdEvent[]
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  choicesByEventId: Map<number, MdEventChoice[]>
  eventSearch: string
  setEventSearch: (v: string) => void
  eventThemeFilter: string
  setEventThemeFilter: (v: string) => void
  onSelectEvent: (event: MdEvent) => void
}

export default function EventTab({
  lang,
  events,
  giftByGameId,
  themes,
  choicesByEventId,
  eventSearch,
  setEventSearch,
  eventThemeFilter,
  setEventThemeFilter,
  onSelectEvent,
}: EventTabProps) {
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }
  const getEventName = (ev: MdEvent) => ev.name
    ? getLocalizedName({ name_kr: ev.name, name_en: ev.name_en, name_jp: ev.name_jp }, lang)
    : null
  const getEventDesc = (ev: MdEvent) => {
    if (lang === 'en') return ev.desc_text_en ?? ev.desc_text
    if (lang === 'ja') return ev.desc_text_jp ?? ev.desc_text
    return ev.desc_text
  }
  const getEventTitle = (ev: MdEvent) => {
    const localizedName = getEventName(ev)
    if (localizedName) return localizedName
    const localizedDesc = getEventDesc(ev)
    return localizedDesc
      ? localizedDesc.split('\n')[0].slice(0, 30)
      : `${t('mirrorDungeon.event.fallbackTitle')} #${ev.id}`
  }

  const rootEvents = useMemo(() => getRootEvents(events, choicesByEventId), [events, choicesByEventId])
  const eventsById = useMemo(() => new Map(events.map(event => [event.id, event])), [events])
  const tSin = useTranslations('sin')

  const themeOptions = useMemo(() => [
    { value: '', label: t('mirrorDungeon.event.allThemes') },
    ...themes
      .filter(th => !th.is_hidden)
      .sort((a, b) => a.id - b.id)
      .map(th => ({
        value: String(th.id),
        label: getLocalizedName({ name_kr: th.name, name_en: th.name_en, name_jp: th.name_jp }, lang),
      })),
  ], [themes, lang])

  const { filteredEvents, totalCount } = useMemo(() => {
    const q = eventSearch.trim().toLowerCase()
    const filtered = q
      ? rootEvents.filter(ev => {
          const localizedName = getEventName(ev)
          const localizedDesc = getEventDesc(ev)
          if (localizedName?.toLowerCase().includes(q) || ev.name?.toLowerCase().includes(q)) return true
          if (localizedDesc?.toLowerCase().includes(q) || ev.desc_text?.toLowerCase().includes(q)) return true
          if (choicesByEventId.get(ev.id)?.some(c =>
            c.message?.toLowerCase().includes(q) || c.message_desc?.toLowerCase().includes(q)
          )) return true
          if (ev.gift_ids?.some(gid => {
            const g = giftByGameId.get(gid)
            if (!g) return false
            const localizedGiftName = getLocalizedName({ name_kr: g.name, name_en: g.name_en, name_jp: g.name_jp }, lang)
            return localizedGiftName.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
          })) return true
          return false
        })
      : rootEvents

    const themeFiltered = eventThemeFilter
      ? filtered.filter(ev => ev.theme_ids?.includes(Number(eventThemeFilter)))
      : filtered

    return { filteredEvents: themeFiltered, totalCount: rootEvents.length }
  }, [rootEvents, eventSearch, eventThemeFilter, giftByGameId, choicesByEventId, lang])

  return (
    <section className={styles.catalog}>
      <div className={styles.filters}>
        <div className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input aria-label={t('mirrorDungeon.event.search')} placeholder={t('mirrorDungeon.event.search')}
            value={eventSearch} onChange={e => setEventSearch(e.target.value)} />
          {eventSearch && <button type="button" onClick={() => setEventSearch('')} aria-label={t('mirrorDungeon.event.clearSearch')}><X size={16} /></button>}
        </div>
        <Dropdown value={eventThemeFilter} options={themeOptions} onChange={setEventThemeFilter}
          prefix={t('mirrorDungeon.event.themePrefix')} defaultValue="" minWidth={140} />
        <span className={styles.count}>{filteredEvents.length} / {totalCount}</span>
      </div>
      <div className={styles.gallery}>
        {filteredEvents.map((event, index) => {
          const gifts = (event.gift_ids ?? []).flatMap(id => giftByGameId.get(id) ?? [])
          const count = groupEventChoices(choicesByEventId.get(event.id) ?? []).length
          const checks = eventCheckSins(choicesByEventId.get(event.id) ?? [], eventsById)
          return (
            <button type="button" key={event.id} className={`ev-card ${styles.card}`} onClick={() => onSelectEvent(event)} data-event-id={event.id}>
              {event.image_url ? <div className={styles.image}>
                <QuietImage src={event.image_url} alt="" fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-contain" loading={index < 6 ? 'eager' : 'lazy'} {...blurPlaceholder(event.image_url)} />
              </div> : <div className={styles.unillustrated}>{t('mirrorDungeon.event.fallbackTitle')}</div>}
              <div className={styles.caption}>
                <h3>{colorizeEventText(getEventTitle(event), lang)}</h3>
                <div className={styles.under}>
                <span>{t('mirrorDungeon.event.choicesLabel')} {count}</span>
                {checks.length > 0 && <ul className={styles.checks}>
                  {checks.map(check => (
                    <li key={check.option} aria-label={`${t('mirrorDungeon.event.checkOption').replace('{n}', String(check.option))}: ${check.sins.map(sin => tSin(sin)).join(', ')}`}>
                      <b aria-hidden="true">{check.option}</b>
                      {check.sins.map(sin => <Image key={sin} src={getSinIconUrl(sin)} alt="" title={tSin(sin)} width={18} height={18} />)}
                    </li>
                  ))}
                </ul>}
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.gifts}>{gifts.filter(gift => gift.image_url).slice(0, 4).map(gift => <span key={gift.id} className={styles.giftPreview}><GiftArtwork gift={gift} displayName={getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang)} sizes="64px" /></span>)}{gifts.length > 4 && <span>+{gifts.length - 4}</span>}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {filteredEvents.length === 0 && <p className={styles.empty}>{t('common.noResults')}</p>}
    </section>
  )
}

'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { eventCheckSins, groupEventChoices } from '@/features/mirror-dungeon/lib/event-flow'
import { colorizeEventText } from '@/features/mirror-dungeon/lib/event-text'
import { getRootEvents } from '@/lib/utils/event-catalog'
import styles from './EventTab.module.css'
import GiftArtwork from '@/components/ui/GiftArtwork'
import Dropdown from '@/components/ui/Dropdown'
import SearchBox, { SuggestCut, SuggestRow, nameMarks, type SuggestGroup } from '@/components/ui/SearchBox'
import QuietImage from '@/components/ui/QuietImage'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice } from '@/features/mirror-dungeon/types'
import { choiceEntries, eventEntries, eventSuggestions, foundEventIds, givenGiftEntries } from '@/features/mirror-dungeon/lib/search-suggestions'
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

  // Reward gifts are matched through the event (its context); the ones listed as suggestions are those some event gives.
  const eventIndex = useMemo(() => eventEntries(rootEvents, giftByGameId, lang, getEventTitle), [rootEvents, giftByGameId, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const choiceIndex = useMemo(() => choiceEntries(rootEvents, choicesByEventId, getEventTitle), [rootEvents, choicesByEventId, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const giftIndex = useMemo(() => givenGiftEntries(rootEvents.map(ev => ev.gift_ids ?? []), giftByGameId, lang), [rootEvents, giftByGameId, lang])
  const rootById = useMemo(() => new Map(rootEvents.map(ev => [String(ev.id), ev])), [rootEvents])

  const suggestGroups = useMemo<SuggestGroup[]>(() => {
    const found = eventSuggestions(eventIndex, choiceIndex, giftIndex, eventSearch)
    return [
      {
        title: t('mirrorDungeon.tab.events'),
        rows: found.events.map(hit => {
          const event = rootById.get(hit.entry.href)!
          return {
            key: `e${event.id}`,
            onPick: () => onSelectEvent(event),
            body: hit.snippet
              ? <SuggestCut image={hit.entry.icon} name={hit.entry.label} {...hit.snippet} />
              : <SuggestRow image={hit.entry.icon} name={hit.entry.label} marks={nameMarks(hit)} />,
          }
        }),
      },
      {
        title: t('mirrorDungeon.event.choicesLabel'),
        rows: found.choices.map(hit => {
          const event = rootById.get(hit.entry.href.split(':')[0])!
          return { key: `c${hit.entry.href}`, onPick: () => onSelectEvent(event), body: <SuggestCut image={event.image_url} name={hit.entry.sublabel!} {...hit.snippet!} /> }
        }),
      },
      {
        title: t('mirrorDungeon.tab.gifts'),
        rows: found.gifts.map(hit => ({
          key: `g${hit.entry.href}`,
          onPick: () => setEventSearch(hit.entry.label),
          body: <SuggestRow image={hit.entry.icon} name={hit.entry.label} marks={nameMarks(hit)} right={`${t('mirrorDungeon.tab.events')} ${hit.entry.sublabel}`} />,
        })),
      },
    ].filter(group => group.rows.length > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIndex, choiceIndex, giftIndex, rootById, eventSearch, lang, onSelectEvent, setEventSearch])

  const { filteredEvents, totalCount } = useMemo(() => {
    const q = eventSearch.trim()
    const found = q ? foundEventIds(eventIndex, choiceIndex, q).map(id => rootById.get(String(id))!) : rootEvents
    const themeFiltered = eventThemeFilter
      ? found.filter(ev => ev.theme_ids?.includes(Number(eventThemeFilter)))
      : found

    return { filteredEvents: themeFiltered, totalCount: rootEvents.length }
  }, [rootEvents, eventSearch, eventThemeFilter, eventIndex, choiceIndex, rootById])

  return (
    <section className={styles.catalog}>
      <div className={styles.filters}>
        <SearchBox
          value={eventSearch}
          onChange={setEventSearch}
          label={t('mirrorDungeon.event.search')}
          clearLabel={t('mirrorDungeon.event.clearSearch')}
          groups={suggestGroups}
          className={styles.search}
        />
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

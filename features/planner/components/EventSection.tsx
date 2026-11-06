'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import type { MdEvent, MdEventChoice, EgoGift, EgoGiftTheme } from '@/features/mirror-dungeon'
import type { GiftData, ThemeData } from '@/lib/planner/types'
import type { SupportedLang } from '@/lib/i18n/types'
import { eventTitle } from '@/lib/utils/event-catalog'
import EventTab from '@/features/mirror-dungeon/components/EventTab'
import EventModal from '@/features/mirror-dungeon/components/EventModal'
import PlannerGiftModal from '@/features/planner/components/PlannerGiftModal'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  events: MdEvent[]
  choices: MdEventChoice[]
  giftMap: Map<number, GiftData>
  themes: ThemeData[]
  observedEventIds?: number[]
}

export default function EventSection({ state, dispatch, events, choices, giftMap, themes, observedEventIds = [] }: Props) {
  const t = useTranslations('planner.run')
  const lang = useLocale() as SupportedLang
  const themeId = state.floorLogs[state.currentFloor - 1]?.themeId
  const log = state.floorLogs[state.currentFloor - 1]
  const [selected, setSelected] = useState<MdEvent | null>(null)
  const [selectedGift, setSelectedGift] = useState<GiftData | null>(null)
  const [search, setSearch] = useState('')
  const [themeFilter, setThemeFilter] = useState(String(themeId ?? ''))
  useEffect(() => setThemeFilter(String(themeId ?? '')), [themeId])
  const localizedChoices = useMemo(() => choices.map(choice => ({
    ...choice,
    message: (lang === 'en' ? choice.message_en : lang === 'ja' ? choice.message_jp : null) || choice.message,
    message_desc: (lang === 'en' ? choice.message_desc_en : lang === 'ja' ? choice.message_desc_jp : null) || choice.message_desc,
    result_text: (lang === 'en' ? choice.result_text_en : lang === 'ja' ? choice.result_text_jp : null) || choice.result_text,
  })), [choices, lang])
  const eventById = useMemo(() => new Map(events.map(event => [event.id, event])), [events])
  const choicesByEventId = useMemo(() => {
    const map = new Map<number, MdEventChoice[]>()
    for (const choice of localizedChoices) map.set(choice.event_id, [...(map.get(choice.event_id) ?? []), choice])
    return map
  }, [localizedChoices])
  const giftByGameId = useMemo(() => new Map([...giftMap].map(([id, gift]) => [id, {
    ...gift, keyword: gift.keyword ?? '', grade: gift.grade ?? '', enhancement: false,
    price: null, buy_disabled: false, is_synthesis: false, related: null,
    difficulty: null, convert_to: null,
    activation_condition: gift.activation_condition ? { ...gift.activation_condition, count: gift.activation_condition.count ?? 0 } : null,
  } as EgoGift])), [giftMap])
  const eventThemes = useMemo(() => themes.map(theme => ({ ...theme, id: Number(theme.id),
    ego_gift_ids: theme.ego_gift_ids ?? [], specific_ego_gift_ids: theme.specific_ego_gift_ids ?? [],
    is_hidden: false, hidden_rate: null, fixed_reward_gift_ids: null,
  } as EgoGiftTheme)), [themes])
  const detected = observedEventIds.flatMap(id => eventById.get(id) ?? [])
  const name = (event: MdEvent) => eventTitle(event, lang) ?? `#${event.id}`

  if (!themeId) return <p className="rounded-md border border-dashed border-[var(--border)] p-5 text-sm text-[var(--text-tertiary)]">{t('chooseThemeFirst')}</p>
  return <div className="space-y-3">
    {detected.length > 0 && <section className="rounded-md border border-[var(--border-gold)] bg-[var(--bg-panel)] p-3"><h3 className="mb-2 text-xs font-bold text-[var(--gold-light)]">{t('observedEventCandidates')}</h3><div className="flex flex-wrap gap-2">{detected.map(event => <button key={event.id} type="button" onClick={() => setSelected(event)} className="min-h-10 rounded-md border border-[var(--border)] px-3 text-xs focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{name(event)}</button>)}</div></section>}
    <EventTab lang={lang} events={events} giftByGameId={giftByGameId} themes={eventThemes} choicesByEventId={choicesByEventId} eventSearch={search} setEventSearch={setSearch} eventThemeFilter={themeFilter} setEventThemeFilter={setThemeFilter} onSelectEvent={setSelected} />
    {selected && <EventModal lang={lang} event={selected} eventById={eventById} choicesByEventId={choicesByEventId} giftByGameId={giftByGameId} themes={eventThemes} onClose={() => setSelected(null)} onSelectGift={gift => { setSelectedGift(gift.game_id == null ? null : giftMap.get(gift.game_id) ?? null) }} onRecordChoice={(eventId, optionIndex) => dispatch({ type: 'SELECT_EVENT_OPTION', eventId, optionIndex, rewardGiftIds: [] })} isChoiceRecorded={(eventId, optionIndex) => !!log?.selectedEventOptions.some(item => item.eventId === eventId && item.optionIndex === optionIndex)} recordLabels={{ record: t('recordChoice'), recorded: t('recordedChoice') }} />}
    {selectedGift && <PlannerGiftModal gift={selectedGift} onClose={() => setSelectedGift(null)} />}
  </div>
}

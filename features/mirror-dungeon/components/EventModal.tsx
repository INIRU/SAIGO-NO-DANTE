'use client'

import { useRef, useState } from 'react'
import { X, ChevronDown, Check, Minus, ArrowUpRight, ArrowRight } from 'lucide-react'
import styles from './EventModal.module.css'
import { getEventOutcomes } from '@/lib/utils/event-outcomes'
import BaseModal from '@/components/ui/BaseModal'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import QuietImage from '@/components/ui/QuietImage'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import type {
  MdEvent,
  MdEventChoice,
  ChoiceEffect,
  EgoGift,
  EgoGiftTheme,
} from '@/features/mirror-dungeon/types'
import {
  colorizeEventText,
  parseUnityColorTags,
} from '@/lib/utils/event-text'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { getLocalizedName } from '@/lib/i18n/localize'
import { Link } from '@/lib/i18n/navigation'

import { groupEventChoices, eventResultCondition } from '@/features/mirror-dungeon/lib/event-flow'
interface EventModalProps {
  lang: SupportedLang
  event: MdEvent
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  themes: EgoGiftTheme[]
  onClose: () => void
  onSelectGift: (gift: EgoGift) => void
  onRecordChoice?: (eventId: number, optionIndex: number) => void
  isChoiceRecorded?: (eventId: number, optionIndex: number) => boolean
  recordLabels?: { record: string; recorded: string }
  /** Link to the full events page, for modals opened outside it. */
  pageLink?: { href: string; label: string }
}

const SIN_LABELS: Record<string, { ko: string; en: string; ja: string }> = {
  CRIMSON:  { ko: '분노', en: 'Wrath',    ja: '憤怒' },
  SCARLET:  { ko: '색욕', en: 'Lust',     ja: '色欲' },
  ORANGE:   { ko: '색욕', en: 'Lust',     ja: '色欲' },
  VIOLET:   { ko: '질투', en: 'Envy',     ja: '嫉妬' },
  INDIGO:   { ko: '오만', en: 'Pride',    ja: '傲慢' },
  AZURE:    { ko: '우울', en: 'Gloom',    ja: '憂鬱' },
  GREEN:    { ko: '탐식', en: 'Gluttony', ja: '暴食' },
  SHAMROCK: { ko: '탐식', en: 'Gluttony', ja: '暴食' },
  YELLOW:   { ko: '나태', en: 'Sloth',    ja: '怠惰' },
  AMBER:    { ko: '나태', en: 'Sloth',    ja: '怠惰' },
}

function tEvent(key: string, lang: SupportedLang): string {
  const entry = translations[key as keyof typeof translations]
  if (!entry) return key
  return entry[lang] ?? entry.ko ?? key
}

function getEventName(event: MdEvent, lang: SupportedLang): string | null {
  if (!event.name) return null
  return getLocalizedName({ name_kr: event.name, name_en: event.name_en, name_jp: event.name_jp }, lang)
}

function getEventDesc(event: MdEvent, lang: SupportedLang): string | null {
  if (lang === 'en') return event.desc_text_en ?? event.desc_text
  if (lang === 'ja') return event.desc_text_jp ?? event.desc_text
  return event.desc_text
}

function getEventTitle(event: MdEvent, lang: SupportedLang): string {
  const name = getEventName(event, lang)
  if (name) return name
  const desc = getEventDesc(event, lang)
  return desc
    ? desc.split('\n')[0].slice(0, 40)
    : `${tEvent('mirrorDungeon.event.fallbackTitle', lang)} #${event.id}`
}

function getGiftCardData(gift: EgoGift, lang: SupportedLang) {
  return {
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang),
  }
}

function EventGift({ gift, lang, onSelect }: { gift: EgoGift; lang: SupportedLang; onSelect: (gift: EgoGift) => void }) {
  return <GiftCard gift={getGiftCardData(gift, lang)} onClick={() => onSelect(gift)}
    size="3.75rem" className={styles.giftReward} />
}

interface FlowProps {
  lang: SupportedLang
  eventById: Map<number, MdEvent>
  choicesByEventId: Map<number, MdEventChoice[]>
  giftByGameId: Map<number, EgoGift>
  onSelectGift: (gift: EgoGift) => void
  onRecordChoice?: EventModalProps['onRecordChoice']
  isChoiceRecorded?: EventModalProps['isChoiceRecorded']
  recordLabels?: EventModalProps['recordLabels']
}
const languageText = (lang: SupportedLang, ko: string, en: string, ja: string) => lang === 'en' ? en : lang === 'ja' ? ja : ko

function NarrationText({ text, lang }: { text: string; lang: SupportedLang }) {
  return <div className={styles.sourceNarration}>{colorizeEventText(text, lang)}</div>
}

function EffectsList({ effects, ...props }: FlowProps & { effects: ChoiceEffect[] }) {
  const gifts = [...new Set(effects.flatMap(effect => effect.gift_id ? [effect.gift_id] : []))]
    .flatMap(id => props.giftByGameId.get(id) ?? [])
  return <div className={styles.sourceEffects}>
    {effects.map((effect, index) => effect.text?.[props.lang]
      ? <p key={index} data-source-effect>{parseUnityColorTags(effect.text[props.lang])}</p> : null)}
    {gifts.length > 0 && <div className={styles.gifts}>{gifts.map(gift =>
      <EventGift key={gift.id} gift={gift} lang={props.lang} onSelect={props.onSelectGift} />)}</div>}
  </div>
}

function SelectionCondition({ raw, ...props }: FlowProps & { raw?: string | null }) {
  if (!raw || raw === 'None') return null
  const [type, value, list] = raw.split('_')
  const name = (id: string) => {
    const gift = props.giftByGameId.get(Number(id))
    return gift ? getGiftCardData(gift, props.lang).name : `#${id}`
  }
  const text = type === 'HasNotEnoughCost'
    ? languageText(props.lang, `코스트 ${value} 이상 보유 시`, `Requires ${value}+ Cost`, `コスト${value}以上所持`)
    : type === 'HasNotEgoGift' ? languageText(props.lang, `${name(value)} 보유 시`, `Requires ${name(value)}`, `${name(value)}所持時`)
    : type === 'HasNotEgoGiftList' ? languageText(props.lang, `다음 중 ${value}개 이상 보유: `, `Requires ${value} or more of: `, `次のうち${value}個以上所持：`) + (list ?? '').split(':').map(name).join(' · ')
    : raw
  return <p className={styles.condition}>{text}</p>
}

function ChoiceResult({ choice, path, ...props }: FlowProps & { choice: MdEventChoice; path: number[] }) {
  const condition = eventResultCondition(choice.result_condition, props.lang)
  return <div data-event-choice={choice.id} className={styles.choiceBody}>
    {condition && <p className={styles.resultCondition}>{condition}</p>}
    <SelectionCondition {...props} raw={choice.selection_condition} />
    {choice.effects && <EffectsList {...props} effects={choice.effects} />}
    {choice.result_text && <details className={styles.narration}>
      <summary>{tEvent('mirrorDungeon.event.outcomeStory', props.lang)}</summary>
      <NarrationText text={choice.result_text} lang={props.lang} />
    </details>}
    {choice.next_event_id && <NextEvent {...props} id={choice.next_event_id} path={path} />}
  </div>
}

function NextEvent({ id, path, ...props }: FlowProps & { id: number; path: number[] }) {
  const event = props.eventById.get(id)
  if (!event) return <p>{languageText(props.lang, '연결된 이벤트 원문 없음', 'Linked event source unavailable', '連結イベント原文なし')} #{id}</p>
  if (path.includes(id)) return <button type="button" className={styles.returnChoice} data-event-return={id}
    onClick={() => document.querySelector(`[data-event-node="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'auto' })}>
    ↩ {languageText(props.lang, '앞선 선택으로 돌아감', 'Return to the earlier choice', '前の選択に戻る')}{getEventName(event, props.lang) ? ` · ${getEventName(event, props.lang)}` : ''}
  </button>
  const nextPath = [...path, id]
  const choices = props.choicesByEventId.get(id) ?? []
  const coin = event.event_type === 'ab' || event.event_type === 'COIN_EVENT'
  return <section className={styles.nextChoices} data-event-node={id}>
    {event.judgment?.intro?.[props.lang] && <NarrationText text={event.judgment.intro[props.lang]} lang={props.lang} />}
    <h4 className={styles.nextTitle}>{colorizeEventText(getEventDesc(event, props.lang) || getEventName(event, props.lang) || languageText(props.lang, '다음 선택지', 'Next choices', '次の選択肢'), props.lang)}</h4>
    {coin ? <>
      <Judgment event={event} lang={props.lang} />
      <div className={styles.branches}>{getEventOutcomes(choices).map(({ choice, kind }) => <div key={choice.id}
        className={`${styles.branch} ${styles.sourceBranch}`} data-event-branch={kind}>
        <h5>{kind === 'success' ? <Check size={14} aria-hidden /> : <Minus size={14} aria-hidden />}{choice.message}</h5>
        <ChoiceResult {...props} choice={choice} path={nextPath} />
        {props.onRecordChoice && props.recordLabels && (() => {
          const index = groupEventChoices(choices).findIndex(group => group.some(item => item.id === choice.id))
          return index < 0 ? null : <button type="button" className={styles.recordChoice} aria-pressed={props.isChoiceRecorded?.(id, index) ?? false} onClick={() => props.onRecordChoice?.(id, index)}>{props.isChoiceRecorded?.(id, index) ? props.recordLabels.recorded : props.recordLabels.record}</button>
        })()}
      </div>)}</div>
    </> : <ChoiceList {...props} choices={choices} path={nextPath} />}
  </section>
}

function Judgment({ event, lang }: { event: MdEvent; lang: SupportedLang }) {
  const { judgement, corrections, participantInfo } = event.judgment ?? {}
  if (!judgement) return null
  return <div className={styles.judgment} data-event-judgment>
    <div>{judgement.judgementDataList.map((sin, index) => {
      const label = SIN_LABELS[sin.attributeType]
      return <span key={index} style={{ color: label ? SIN_COLORS[SIN_KR_TO_EN[label.ko]] : undefined }}>{label?.[lang] ?? sin.attributeType}</span>
    })}<strong>{judgement.inclusiveValue}{judgement.upDownType === 1 ? '+' : '−'}</strong></div>
    {participantInfo && participantInfo.max > 1 && <p>{languageText(lang, '참여 인격', 'Participating Identities', '参加人格')} {participantInfo.min}–{participantInfo.max}</p>}
    {corrections?.map((correction, index) => <p key={index}>{correction.labels[lang]} <strong>{correction.adder > 0 ? '+' : ''}{correction.adder}</strong></p>)}
  </div>
}

function ChoiceList({ choices, path, ...props }: FlowProps & { choices: MdEventChoice[]; path: number[] }) {
  return <div className={styles.sourceChoices}>{groupEventChoices(choices).map((group, index) => <details className={styles.choice} key={group[0].id}>
    <summary className={styles.choiceHeader}>
      <span className={styles.choiceNumber}>{String(index + 1).padStart(2, '0')}</span>
      <span className={styles.choiceHeading}>
        <span className={styles.choiceTitle}>{colorizeEventText(group[0].message, props.lang)}</span>
        {group[0].message_desc && <span className={styles.choiceDescription}>{colorizeEventText(group[0].message_desc, props.lang)}</span>}
      </span><ChevronDown className={styles.choiceChevron} size={17} aria-hidden />
    </summary>
    {group.map(choice => <ChoiceResult {...props} key={choice.id} choice={choice} path={path} />)}
    {props.onRecordChoice && props.recordLabels && <button type="button" className={styles.recordChoice} aria-pressed={props.isChoiceRecorded?.(path[path.length - 1], index) ?? false} onClick={() => props.onRecordChoice?.(path[path.length - 1], index)}>{props.isChoiceRecorded?.(path[path.length - 1], index) ? props.recordLabels.recorded : props.recordLabels.record}</button>}
  </details>)}</div>
}

function EventChoices({ event, ...props }: FlowProps & { event: MdEvent }) {
  const [active, setActive] = useState(0)
  const groups = groupEventChoices(props.choicesByEventId.get(event.id) ?? [])
  const group = groups[active]
  if (!group) return <p className={styles.empty}>{tEvent('mirrorDungeon.event.noChoices', props.lang)}</p>
  return <div data-event-node={event.id}>
    <div className={styles.sectionHeading}>
      <h3>{tEvent('mirrorDungeon.event.choicesLabel', props.lang)}</h3><span>{String(groups.length).padStart(2, '0')}</span>
    </div>
    <div className={styles.choiceNav} aria-label={tEvent('mirrorDungeon.event.choicesLabel', props.lang)}>
      {groups.map(([item], index) => <button key={item.id} type="button" className={styles.choiceOption}
        aria-pressed={index === active} aria-controls="event-choice-result" onClick={() => setActive(index)} data-choice-option={item.id}>
        <span className={styles.optionNumber}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.optionText}><strong>{colorizeEventText(item.message, props.lang)}</strong>
          {item.message_desc && <span>{colorizeEventText(item.message_desc, props.lang)}</span>}</span>
        <ArrowRight size={17} aria-hidden />
      </button>)}
    </div>
    <section id="event-choice-result" className={styles.resultPanel} key={group[0].id} aria-label={tEvent('mirrorDungeon.event.choiceResult', props.lang)}>
      <div className={styles.sectionHeading}><h3>{tEvent('mirrorDungeon.event.choiceResult', props.lang)}</h3>
        <span>{String(active + 1).padStart(2, '0')} / {String(groups.length).padStart(2, '0')}</span></div>
      {group.map(choice => <ChoiceResult {...props} key={choice.id} choice={choice} path={[event.id]} />)}
      {props.onRecordChoice && props.recordLabels && <button type="button" className={styles.recordChoice} aria-pressed={props.isChoiceRecorded?.(event.id, active) ?? false} onClick={() => props.onRecordChoice?.(event.id, active)}>{props.isChoiceRecorded?.(event.id, active) ? props.recordLabels.recorded : props.recordLabels.record}</button>}
    </section>
  </div>
}

export default function EventModal({ lang, event, eventById, choicesByEventId, giftByGameId, themes, onClose, onSelectGift, onRecordChoice, isChoiceRecorded, recordLabels, pageLink }: EventModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const eventTitle = getEventTitle(event, lang)
  const eventDesc = getEventDesc(event, lang)
  const evThemes = (event.theme_ids ?? []).flatMap(id => themes.find(t => t.id === id) ?? [])
  const evGifts = (event.gift_ids ?? []).flatMap(id => giftByGameId.get(id) ?? [])
  const handleSelectGift = (gift: EgoGift) => { onClose(); onSelectGift(gift) }

  return (
    <BaseModal open onClose={onClose} maxWidth="76rem" padding=".75rem" title={eventTitle}>
      <div className={styles.modal}>
        <header className={styles.toolbar}>
          <span>{tEvent('mirrorDungeon.event.modalTitle', lang)}</span>
          <span className={styles.recordId}>#{event.id}</span>
          <button type="button" className={styles.jumpToChoices} onClick={() => {
            contentRef.current?.scrollIntoView({ block: 'start' })
            contentRef.current?.focus({ preventScroll: true })
          }}>{tEvent('mirrorDungeon.event.choicesLabel', lang)} <ChevronDown size={14} aria-hidden="true" /></button>
          {pageLink && <Link href={pageLink.href} className={styles.pageLink}>{pageLink.label} <ArrowUpRight size={14} aria-hidden="true" /></Link>}
          <button type="button" onClick={onClose} aria-label={tEvent('mirrorDungeon.theme.close', lang)} className={styles.close}><X size={20} /></button>
        </header>
        <div className={styles.layout}>
          <div className={`event-modal-sidebar ${styles.scene}`}>
            {event.image_url && (
              <a href={event.image_url} target="_blank" rel="noreferrer" className={styles.artwork}
                aria-label={tEvent('mirrorDungeon.event.openArtwork', lang)}>
                <QuietImage src={event.image_url} alt="" fill sizes="(max-width: 767px) 100vw, 36rem" className="object-contain" loading="eager" {...blurPlaceholder(event.image_url)} />
                <span className={styles.artExpand}><ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>
            )}
            <div className={styles.sceneText}>
              <h2>{eventTitle}</h2>
              {eventDesc && <div className={styles.story}>{<p>{colorizeEventText(eventDesc, lang)}</p>}</div>}
              {evGifts.length > 0 && <section className={styles.related}>
                <h3>{tEvent('mirrorDungeon.event.availableGifts', lang)}</h3>
                <div className={styles.gifts}>{evGifts.map(gift => <EventGift key={gift.id} gift={gift} lang={lang} onSelect={handleSelectGift} />)}</div>
              </section>}
              {evThemes.length > 0 && <details className={styles.themes}>
                <summary>{tEvent('mirrorDungeon.event.relatedThemes', lang)} <span>{evThemes.length}</span></summary>
                <ul>{evThemes.map(theme => <li key={theme.id}>{getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang)}</li>)}</ul>
              </details>}
            </div>
          </div>
          <div ref={contentRef} tabIndex={-1} className={`event-modal-content ${styles.content}`}>
            <EventChoices key={event.id} lang={lang} event={event} eventById={eventById} choicesByEventId={choicesByEventId} giftByGameId={giftByGameId} onSelectGift={handleSelectGift} onRecordChoice={onRecordChoice} isChoiceRecorded={isChoiceRecorded} recordLabels={recordLabels} />
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

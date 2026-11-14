'use client'

import { useLocale, useTranslations } from 'next-intl'
import type { GiftData } from '@/lib/planner/types'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { groupEventChoices, eventResultCondition, type ChoiceEffect, type MdEvent, type MdEventChoice } from '@/features/mirror-dungeon'
import { eventTitle } from '@/lib/utils/event-catalog'
import { getEventOutcomes, type EventOutcomeKind } from '@/lib/utils/event-outcomes'
import { SIN_COLORS } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { Lock, Swords } from 'lucide-react'
import GiftArtwork from '@/components/ui/GiftArtwork'

type BranchSummary = { lines: string[]; gifts: { id: number; conditional: boolean }[] }
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

// 게임 데이터의 죄악 속성 코드
const SIN_CODES: Record<string, SinType> = {
  CRIMSON: 'wrath', SCARLET: 'lust', ORANGE: 'lust', AMBER: 'sloth', YELLOW: 'sloth',
  SHAMROCK: 'gluttony', GREEN: 'gluttony', AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}

/** 효과가 누구에게 가는지: 대상(모든 아군, 무작위 N명…)과 조건(속성 스킬 보유/미보유, 판정 성공/실패)을 한 문구로. */
function TargetLabel({ target, condition, t, ts }: { target: string; condition?: string; t: Translate; ts: (key: string) => string }) {
  const random = /^RandomAlly_(\d+)$/.exec(target)
  const pick = random ? t('pipEventRandomAllies', { count: Number(random[1]) })
    : target === 'LowestHpAlly_1' ? t('pipEventLowestHp')
    : target === 'LowestMpAlly_1' ? t('pipEventLowestSp') : ''
  const skill = condition ? /^(Not)?IncludeSkillAttribute_(.+)$/.exec(condition) : null
  const sins = skill?.[2].split(',').flatMap(code => SIN_CODES[code] ? [SIN_CODES[code]] : []) ?? []
  if (sins.length) {
    const sinNames = () => sins.map((sin, index) => <span key={sin}>{index > 0 && '·'}<span style={{ color: SIN_COLORS[sin] }}>{ts(sin)}</span></span>)
    const group = t.rich(skill?.[1] ? 'pipEventLacksSinSkill' : 'pipEventHasSinSkill', { sins: sinNames })
    return <span className="text-[var(--text-secondary)]">{pick ? t.rich('pipEventAmong', { group: () => group, target: pick }) : group}</span>
  }
  const label = condition === 'SUCCESS' ? t('pipEventCheckPassed')
    : condition === 'FAILURE' ? t('pipEventCheckFailed')
    : pick || (target === 'EveryAlly' ? t('pipEventAllAllies') : target === 'ChosenPersonality' ? t('pipEventChosenSinner') : '')
  return label ? <span className="text-[var(--text-secondary)]">{label}</span> : null
}

/** Structured DB effects only; no narration or inferred clicked choice. */
export function summarizeChoiceEffects(effects: ChoiceEffect[] | null, _lang: SupportedLang): BranchSummary {
  const lines: string[] = []
  const gifts = new Map<number, boolean>()
  for (const effect of effects ?? []) {
    const source = record(effect.source)
    const reward = record(source.itemReward)
    const result = typeof source.resultEffect === 'string' ? source.resultEffect : ''
    const giftIds = [effect.gift_id, reward.type === 'EGO_GIFT' ? reward.rewardId : null]
    for (const raw of giftIds) {
      const id = number(raw)
      if (id !== null && Number.isInteger(id) && id > 0) gifts.set(id,
        (gifts.get(id) ?? false) || result.includes('OnWinBattle') || effect.type === 'gift_battle')
    }
    if (result === 'Nothing' || effect.type === 'nothing') { lines.push('nothing'); continue }
    if (result.startsWith('GetConfirmedEgogift') || effect.type === 'gift' || effect.type === 'gift_battle') {
      if (!giftIds.some(raw => number(raw) !== null)) lines.push('unknown')
      continue
    }
    if (/^StartBattle(?:_|$)/.test(result) || effect.type === 'battle' || effect.type === 'battle_abnormality') {
      lines.push('battle')
      continue
    }
    if (result === 'MirrorDungeonAcquireCost' || result === 'MirrorDungeonLossCost' || effect.type === 'cost' || effect.type === 'cost_loss') {
      const amount = number(reward.num) ?? number(effect.amount)
      if (amount !== null) lines.push(`cost:${result === 'MirrorDungeonLossCost' || effect.type === 'cost_loss' ? '-' : '+'}${amount}`)
      else lines.push('unknown')
      continue
    }
    const different = /^(Lose|Recover)HpMpDifferentAmount_(\d+)_(\d+)$/.exec(result)
    const same = /^(Lose|Recover)HpMpSameAmount_(\d+)$/.exec(result)
    const single = /^(Lose|Recover)(Ratio)?(Hp|Mp)Only_(\d+)$/.exec(result)
    // 대상|조건: 조건이 다르면 같은 수치여도 다른 줄이다(오만 보유 인격 회복 ≠ 모든 아군 회복)
    const who = [source.resultEffectTarget ?? '', source.resultEffectCondition1].filter(Boolean).join('|')
    if (different) {
      const sign = different[1] === 'Lose' ? '−' : '+'
      lines.push(`stat:${who}:HP${sign}${different[2]} · SP${sign}${different[3]}`)
    } else if (same) {
      const sign = same[1] === 'Lose' ? '−' : '+'
      lines.push(`stat:${who}:HP${sign}${same[2]} · SP${sign}${same[2]}`)
    } else if (single) lines.push(`stat:${who}:${single[3] === 'Hp' ? 'HP' : 'SP'}${single[1] === 'Lose' ? '−' : '+'}${single[4]}${single[2] ? '%' : ''}`)
    else if (effect.type === 'hp_mp_loss' || effect.type === 'hp_mp_recover') {
      const hp = number(effect.hp)
      const sp = number(effect.mp)
      if (hp !== null && sp !== null) lines.push(`stat::HP${effect.type.endsWith('loss') ? '−' : '+'}${hp} · SP${effect.type.endsWith('loss') ? '−' : '+'}${sp}`)
      else lines.push('unknown')
    } else if (effect.type === 'hp_loss' || effect.type === 'hp_recover' || effect.type === 'mp_loss' ||
      effect.type === 'mp_recover' || effect.type === 'hp_recover_ratio') {
      const amount = number(effect.amount) ?? number(effect.hp) ?? number(effect.mp)
      if (amount !== null) lines.push(`stat::${effect.type.startsWith('hp') ? 'HP' : 'SP'}${effect.type.endsWith('loss') ? '−' : '+'}${amount}${effect.type.endsWith('ratio') ? '%' : ''}`)
      else lines.push('unknown')
    } else if (result) lines.push('unknown')
    // The source text is kept out of PiP; unknown effects remain unknown.
  }
  return { lines: [...new Set(lines)], gifts: [...gifts].map(([id, conditional]) => ({ id, conditional })) }
}

function resultLabel(raw: string | null | undefined, lang: SupportedLang, unknown: string): string {
  if (!raw || raw === 'Prob_1') return ''
  const translated = eventResultCondition(raw, lang)
  return translated === raw ? unknown : translated
}

function selectionLabel(raw: string | null | undefined, giftMap: Map<number, GiftData>, lang: SupportedLang,
  t: ReturnType<typeof useTranslations<'planner.run'>>): string {
  if (!raw || raw === 'None') return ''
  const cost = /^HasNotEnoughCost_(\d+)$/.exec(raw)
  if (cost) return t('pipEventCostRequirement', { amount: cost[1] })
  const gift = /^HasNotEgoGift_(\d+)$/.exec(raw)
  if (gift) {
    const item = giftMap.get(Number(gift[1]))
    if (item) return t('pipEventGiftRequirement', { name: getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, lang) })
  }
  const giftList = /^HasNotEgoGiftList_(\d+)_(\d+(?::\d+)*)$/.exec(raw)
  if (giftList) {
    const names = giftList[2].split(':').flatMap(id => {
      const item = giftMap.get(Number(id))
      return item ? [getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, lang)] : []
    })
    if (names.length) return t('pipEventGiftListRequirement', { count: giftList[1], names: names.join(' · ') })
  }
  return t('pipEventUnknownCondition')
}

type Translate = ReturnType<typeof useTranslations<'planner.run'>>

/** Splits a summary line into readable parts: a signed stat keeps its number apart so the sign can carry colour. */
export function effectTokens(line: string): { kind: 'battle' | 'nothing' | 'unknown' } | { kind: 'values'; target: string; condition?: string; values: { stat: 'HP' | 'SP' | 'cost'; sign: '+' | '−'; amount: string }[] } {
  if (line === 'battle' || line === 'nothing' || line === 'unknown') return { kind: line }
  if (line.startsWith('cost:')) {
    const [, sign, amount] = /^cost:([+-])(.+)$/.exec(line) ?? []
    return sign ? { kind: 'values', target: '', values: [{ stat: 'cost', sign: sign === '-' ? '−' : '+', amount }] } : { kind: 'unknown' }
  }
  const [, who = '', amounts = ''] = /^stat:([^:]*):(.*)$/.exec(line) ?? []
  const [target, condition] = who.split('|')
  const values = amounts.split(' · ').flatMap(part => {
    const match = /^(HP|SP)([+−])(.+)$/.exec(part)
    return match ? [{ stat: match[1] as 'HP' | 'SP', sign: match[2] as '+' | '−', amount: match[3] }] : []
  })
  return values.length ? { kind: 'values', target, condition: condition || undefined, values } : { kind: 'unknown' }
}

function Effect({ line, t, ts }: { line: string; t: Translate; ts: (key: string) => string }) {
  const token = effectTokens(line)
  if (token.kind === 'battle') return <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]"><Swords size={13} aria-hidden="true" className="text-[var(--gold-light)]" />{t('pipEventBattle')}</span>
  if (token.kind !== 'values') return <span className="text-[var(--text-tertiary)]">{t(token.kind === 'nothing' ? 'pipEventNothing' : 'pipEventUnknownEffect')}</span>
  return <span className="inline-flex flex-wrap items-baseline gap-x-2">
    <TargetLabel target={token.target} condition={token.condition} t={t} ts={ts} />
    {token.values.map(value => <span key={value.stat} data-effect-sign={value.sign === '+' ? 'gain' : 'loss'} className="whitespace-nowrap">
      <span className="text-[var(--text-secondary)]">{t(value.stat === 'HP' ? 'pipEventHp' : value.stat === 'SP' ? 'pipEventSp' : 'pipEventCost')}</span>{' '}
      <span className={`font-[family-name:var(--font-title)] text-[0.9375rem] leading-none tracking-wide ${value.sign === '+' ? 'text-[var(--success)]' : 'text-[#e0685c]'}`}>{value.sign}{value.amount}</span>
    </span>)}
  </span>
}

export default function CompanionEventChoices({ eventId, events, choices, giftMap }: {
  eventId: number
  events: MdEvent[]
  choices: MdEventChoice[]
  giftMap: Map<number, GiftData>
}) {
  const t = useTranslations('planner.run')
  const ts = useTranslations('sin')
  const lang = useLocale() as SupportedLang
  const eventById = new Map(events.map(event => [event.id, event]))
  const choicesById = new Map<number, MdEventChoice[]>()
  for (const choice of choices) choicesById.set(choice.event_id, [...(choicesById.get(choice.event_id) ?? []), choice])
  const event = eventById.get(eventId)
  const groups = groupEventChoices(choicesById.get(eventId) ?? [])
  if (!event || !groups.length) return null
  const localized = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang)
  const eventName = eventTitle(event, lang) ?? ''

  /** One result of a choice: when it happens, then what it does. Follow-up choices nest under a single gold rule. */
  const renderBranch = (choice: MdEventChoice, kind: EventOutcomeKind, path: Set<number>, label: string, depth = 0) => {
    const summary = summarizeChoiceEffects(choice.effects, lang)
    const chance = Number(choice.probability)
    const condition = resultLabel(choice.result_condition, lang, t('pipEventUnknownCondition')) ||
      (Number.isFinite(chance) && chance > 0 && chance < 1 ? `${Number((chance * 100).toFixed(2))}%` : '')
    const requirement = selectionLabel(choice.selection_condition, giftMap, lang, t)
    const next = choice.next_event_id && !path.has(choice.next_event_id) && depth < 2
      ? choicesById.get(choice.next_event_id) ?? [] : []
    const nextPath = new Set(path)
    if (choice.next_event_id) nextPath.add(choice.next_event_id)
    const nextOutcomesOnly = next.length > 0 && getEventOutcomes(next).every(item => item.kind !== 'other')
    return <div key={choice.id} className="space-y-1" data-event-outcome={kind}>
      {requirement && <p className="flex items-center gap-1 text-[0.6875rem] leading-4 text-[var(--text-secondary)]"><Lock size={11} aria-hidden="true" className="shrink-0 text-[var(--text-tertiary)]" />{requirement}</p>}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-5">
        {(kind !== 'other' || condition) && <span className="whitespace-nowrap font-semibold text-[var(--gold-light)]">
          {kind !== 'other' && t(kind === 'success' ? 'pipEventSuccess' : 'pipEventFailure')}{kind !== 'other' && condition ? ' ' : ''}
          {condition && <span className="font-normal text-[var(--text-secondary)]">{condition}</span>}
        </span>}
        {summary.lines.map(line => <Effect key={line} line={line} t={t} ts={ts} />)}
        {!summary.lines.length && !summary.gifts.length && !choice.next_event_id &&
          <span className="text-[var(--text-tertiary)]">{t('pipEventNoKnownOutcome')}</span>}
      </div>
      {summary.gifts.length > 0 && <ul className="flex flex-wrap gap-x-3 gap-y-1.5">{summary.gifts.map(({ id, conditional }) => {
        const gift = giftMap.get(id)
        if (!gift) return null
        return <li key={id} className="flex min-w-0 max-w-full items-center gap-2" data-event-gift={id}>
          <span className="w-10 shrink-0"><GiftArtwork gift={gift} displayName={localized(gift)} sizes="40px" /></span>
          <span className="min-w-0 text-xs leading-4">
            <span className="block break-keep font-[family-name:var(--font-heading)] text-[var(--text-primary)]">{localized(gift)}</span>
            {conditional && <span className="block text-[0.6875rem] text-[var(--gold-light)]">{t('pipEventOnBattleWin')}</span>}
          </span>
        </li>
      })}</ul>}
      {next.length > 0 && <div className="mt-1.5 space-y-2 border-l border-[var(--gold-dim)] pl-2.5" aria-label={t('pipEventNextOutcomes')} role="group">
        {nextOutcomesOnly
          ? getEventOutcomes(next).map(({ choice: linked, kind: linkedKind }) => renderBranch(linked, linkedKind, nextPath, label, depth + 1))
          : groupEventChoices(next).map((group, index) => <div key={group[0].id} className="grid grid-cols-[auto_1fr] gap-x-2">
            <span role="heading" aria-level={4} aria-label={t('pipEventNextOption', { number: index + 1 })}
              className="font-[family-name:var(--font-title)] text-base leading-5 text-[var(--gold)]">{label}-{index + 1}</span>
            <div className="min-w-0 space-y-1.5">{getEventOutcomes(group).map(({ choice: linked, kind: linkedKind }) =>
              renderBranch(linked, linkedKind, nextPath, `${label}-${index + 1}`, depth + 1))}</div>
          </div>)}
      </div>}
      {choice.next_event_id && !next.length && <p className="text-[0.6875rem] text-[var(--text-tertiary)]">{t('pipEventFurtherChoices')}</p>}
    </div>
  }
  return <section data-companion-event={eventId} aria-label={t('pipEventMode')}>
    <h2 className="border-b border-[var(--border-gold)] pb-1.5 font-[family-name:var(--font-heading)] text-sm leading-5 text-[var(--text-primary)] break-keep">{eventName || t('pipEventMode')}</h2>
    <ol className="divide-y divide-[var(--border)]">{groups.map((group, index) => <li key={group[0].id} className="grid grid-cols-[1.5rem_1fr] gap-x-2 py-2.5">
      <h3 aria-label={t('choiceNumber', { number: index + 1 })} className="font-[family-name:var(--font-title)] text-[1.75rem] leading-none text-[var(--gold-light)]">{index + 1}</h3>
      <div className="min-w-0 space-y-2">{getEventOutcomes(group).map(({ choice, kind }) => renderBranch(choice, kind, new Set([eventId]), String(index + 1)))}</div>
    </li>)}</ol>
  </section>
}

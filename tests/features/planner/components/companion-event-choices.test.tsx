import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CompanionEventChoices, { effectTokens, summarizeChoiceEffects } from '@/features/planner/components/CompanionEventChoices'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon/types'
import type { GiftData } from '@/lib/planner/types'

vi.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => Object.assign((key: string) => key, {
    rich: (key: string, values: Record<string, unknown>) => [key, ...Object.values(values).map(value => typeof value === 'function' ? value([]) : value)],
  }),
}))
vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))

const choice = (id: number, eventId: number, option: number, overrides: Partial<MdEventChoice> = {}): MdEventChoice => ({
  id, event_id: eventId, option_index: option, sort_order: option * 100,
  message: `선택지 지문 ${id}`, message_desc: null, result_text: `결과 지문 ${id}`,
  probability: null, next_event_id: null, effects: null, ...overrides,
})

it('summarizes structured HP/SP, cost, battle and conditional gift IDs without reading narrative text', () => {
  expect(summarizeChoiceEffects([
    { type: 'hp_mp_loss', hp: 12, mp: 10 },
    { type: 'cost', amount: 20 },
    { type: 'battle' },
    { type: 'gift_battle', source: { resultEffect: 'GetConfirmedEgogiftOnWinBattle', itemReward: { type: 'EGO_GIFT', rewardId: 9108 } } },
    { type: 'hp_recover_ratio', amount: 30 },
    { type: 'unknown', source: { resultEffect: 'RecoverHpOnlyUntilMax' } },
  ], 'ko')).toEqual({
    lines: ['stat::HP−12 · SP−10', 'cost:+20', 'battle', 'stat::HP+30%', 'unknown'],
    gifts: [{ id: 9108, conditional: true }],
  })
})

it('shows numbered choices and distinct nested options, while hiding choice and result prose', () => {
  const events = [{ id: 901002 }, { id: 90100201 }] as MdEvent[]
  const choices = [
    choice(1, 901002, 0, { effects: [{ type: 'hp_mp_loss', hp: 12, mp: 10 }] }),
    choice(2, 901002, 1, { next_event_id: 90100201 }),
    choice(3, 901002, 2, { effects: [
      { type: 'battle' },
      { type: 'gift_battle', source: { resultEffect: 'GetConfirmedEgogiftOnWinBattle', itemReward: { type: 'EGO_GIFT', rewardId: 9108 } } },
    ] }),
    choice(4, 90100201, 0, { effects: [{ type: 'gift', gift_id: 9002 }] }),
    choice(5, 90100201, 1, { effects: [{ type: 'nothing' }] }),
  ]
  const gifts = new Map([[9108, { game_id: 9108, name: '경외심' } as GiftData],
    [9002, { game_id: 9002, name: '도착증' } as GiftData]])
  const html = renderToStaticMarkup(<CompanionEventChoices eventId={901002} events={events} choices={choices} giftMap={gifts} />)
  expect(html).toContain('data-companion-event="901002"')
  expect(html.match(/<h3\b/g)).toHaveLength(3)
  expect(html.match(/pipEventNextOption/g)).toHaveLength(2)
  expect(html).toContain('data-event-gift="9108"')
  expect(html).toContain('data-event-gift="9002"')
  expect(html).toContain('pipEventOnBattleWin')
  expect(html).not.toContain('선택지 지문')
  expect(html).not.toContain('결과 지문')
})

it('splits effects into signed values so gains and losses read apart, keeping unknowns unknown', () => {
  expect(effectTokens('battle')).toEqual({ kind: 'battle' })
  expect(effectTokens('stat:EveryAlly:HP−12 · SP−10')).toEqual({ kind: 'values', target: 'EveryAlly', values: [
    { stat: 'HP', sign: '−', amount: '12' }, { stat: 'SP', sign: '−', amount: '10' }] })
  expect(effectTokens('stat::HP+30%')).toEqual({ kind: 'values', target: '', values: [{ stat: 'HP', sign: '+', amount: '30%' }] })
  expect(effectTokens('cost:-20')).toEqual({ kind: 'values', target: '', values: [{ stat: 'cost', sign: '−', amount: '20' }] })
  expect(effectTokens('stat::garbled')).toEqual({ kind: 'unknown' })
})

it('numbers each choice for assistive tech, shows conditions and outcomes but no prose', () => {
  const events = [{ id: 7001, name: '거미의 방' }] as MdEvent[]
  const choices = [
    choice(11, 7001, 0, { outcome: 'success', probability: '0.5', effects: [{ type: 'hp_mp_recover', hp: 5, mp: 5 }] }),
    choice(12, 7001, 0, { outcome: 'failure', probability: '0.5', sort_order: 1, effects: [{ type: 'hp_loss', amount: 8 }] }),
    choice(13, 7001, 1, { selection_condition: 'HasNotEnoughCost_15', effects: [{ type: 'unknown', source: { resultEffect: 'Mystery' } }] }),
  ]
  const html = renderToStaticMarkup(<CompanionEventChoices eventId={7001} events={events} choices={choices} giftMap={new Map()} />)
  expect(html).toContain('거미의 방')
  expect(html).toContain('aria-label="choiceNumber"')
  expect(html.match(/<h3\b/g)).toHaveLength(2)
  expect(html).toContain('pipEventSuccess')
  expect(html).toContain('pipEventFailure')
  expect(html.match(/>50%</g)).toHaveLength(2)
  expect(html.match(/data-effect-sign="gain"/g)).toHaveLength(2)
  expect(html.match(/data-effect-sign="loss"/g)).toHaveLength(1)
  expect(html).toContain('pipEventCostRequirement')
  expect(html).toContain('pipEventUnknownEffect')
  expect(html).not.toMatch(/선택지 지문|결과 지문/)
})

it('keeps who an effect applies to: a Pride-skill heal is not an all-allies heal', () => {
  // 오만 선택지(901026·901028)와 판정 실패 선택지의 실제 데이터 모양
  const effects = [
    { type: 'source', source: { resultEffect: 'RecoverHpOnly_10', resultEffectTarget: 'EveryAlly' } },
    { type: 'source', source: { resultEffect: 'RecoverHpOnly_10', resultEffectTarget: 'EveryAlly', resultEffectCondition1: 'IncludeSkillAttribute_INDIGO' } },
    { type: 'source', source: { resultEffect: 'LoseHpOnly_10', resultEffectTarget: 'RandomAlly_1', resultEffectCondition1: 'NotIncludeSkillAttribute_CRIMSON,VIOLET' } },
    { type: 'source', source: { resultEffect: 'LoseMpOnly_12', resultEffectTarget: 'ChosenPersonality', resultEffectCondition1: 'FAILURE' } },
  ]
  const { lines } = summarizeChoiceEffects(effects, 'ko')
  expect(lines).toEqual([
    'stat:EveryAlly:HP+10',
    'stat:EveryAlly|IncludeSkillAttribute_INDIGO:HP+10',
    'stat:RandomAlly_1|NotIncludeSkillAttribute_CRIMSON,VIOLET:HP−10',
    'stat:ChosenPersonality|FAILURE:SP−12',
  ])
  expect(effectTokens(lines[1])).toMatchObject({ target: 'EveryAlly', condition: 'IncludeSkillAttribute_INDIGO' })

  const html = renderToStaticMarkup(<CompanionEventChoices eventId={901026} events={[{ id: 901026 }] as MdEvent[]}
    choices={[choice(21, 901026, 0, { effects })]} giftMap={new Map()} />)
  expect(html).toContain('pipEventAllAllies')
  expect(html).toContain('pipEventHasSinSkill')
  expect(html).toMatch(/color:#3870b0[^>]*>pride/)
  expect(html).toContain('pipEventLacksSinSkill')
  expect(html).toContain('pipEventAmong')
  expect(html).toContain('pipEventCheckFailed')
})

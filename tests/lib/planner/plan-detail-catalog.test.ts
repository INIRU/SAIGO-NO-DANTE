import { describe, expect, it } from 'vitest'
import { trimPlanDetailCatalog } from '@/lib/planner/plan-detail-catalog'

const gift = (game_id: number, name: string) => ({ id: `g${game_id}`, game_id, name })
const gifts = [1, 2, 3, 4, 5, 6, 7, 8].map(n => gift(n, `기프트${n}`))
const recipes = [
  { id: 'r1', result_name: '기프트3', ingredients: ['기프트4', '기프트5'] },
  { id: 'r2', result_name: '기프트7', ingredients: ['기프트8', '기프트8'] },
]
const themes = [{ id: '10', fixed_reward_gift_ids: [6], specific_ego_gift_ids: [2] }, { id: '11', fixed_reward_gift_ids: [7], specific_ego_gift_ids: [] }]
const identities = [{ id: 'i1', sinner_id: 's1', game_id: '100' }, { id: 'i2', sinner_id: 's1', game_id: '200' }, { id: 'i3', sinner_id: 's2', game_id: '300' }]
const egos = [{ id: 'e1', sinner_id: 's1', grade: 'ZAYIN', name_kr: 'a' }, { id: 'e2', sinner_id: 's1', grade: 'HE', name_kr: 'b' }]

const base = { gifts, recipes, themes, identities, egos, events: [] as { gift_ids?: number[] | null }[], eventChoices: [] as { effects?: unknown; selection_condition?: string | null }[] }

describe('trimPlanDetailCatalog', () => {
  it('keeps only gifts the plan references, plus recipe parts and theme rewards', () => {
    const out = trimPlanDetailCatalog({
      ...base,
      plan: { description: null, deck: [], egos: [], gift_inventory: ['start_1', 'final_3_plus'], floor_plan: [{ theme_id: '10', gift_ids: ['5'] }] },
    })
    expect(out.gifts.map(g => g.game_id).sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(out.recipes.map(r => r.id)).toEqual(['r1'])
  })

  it('keeps gifts used by events and named in the description', () => {
    const out = trimPlanDetailCatalog({
      ...base,
      events: [{ gift_ids: [8] }],
      eventChoices: [{ effects: [{ gift_id: 4 }], selection_condition: 'HasNotEgoGift_2' }],
      plan: { description: '본문 기프트1 언급', deck: [], egos: [], gift_inventory: [], floor_plan: [] },
    })
    expect(out.gifts.map(g => g.game_id).sort()).toEqual([1, 2, 3, 4, 5, 7, 8])
  })

  it('keeps only the identities and egos of the deck', () => {
    const out = trimPlanDetailCatalog({
      ...base,
      plan: { description: null, deck: [{ identity_id: 'i1', sinner_id: 's1' }, { identity_id: 'gone', sinner_id: 's1', game_id: '200' }], egos: [{ ego_id: 'e2' }], gift_inventory: [], floor_plan: [] },
    })
    expect(out.identities.map(i => i.id).sort()).toEqual(['i1', 'i2'])
    expect(out.egos.map(e => e.id)).toEqual(['e2'])
  })
})

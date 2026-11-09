import { describe, expect, it } from 'vitest'
import { trimPlanDetailCatalog, slimPlanThemes } from '@/features/planner/lib/plan-detail-catalog'

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

describe('slimPlanThemes', () => {
  const theme = (id: string, ego: number[]) => ({ id, name: id, ego_gift_ids: ego, specific_ego_gift_ids: [9], fixed_reward_gift_ids: null })
  it('REQ-PLANNER-048 keeps a floor theme whole and cuts the other themes\' gift pools to the plan\'s gifts', () => {
    const slim = slimPlanThemes([theme('1', [1, 2, 3, 4]), theme('2', [2, 3, 5, 6])], { floorThemeIds: new Set(['1']), giftIds: new Set([2, 5]) })
    // the floor board counts the floor theme's whole pool
    expect(slim[0].ego_gift_ids).toEqual([1, 2, 3, 4])
    // the gift window asks only whether a plan gift is in a theme's pool
    expect(slim[1].ego_gift_ids).toEqual([2, 5])
    expect(slim[1].specific_ego_gift_ids).toEqual([9])
  })
})

it('REQ-PLANNER-048 the plan detail page sends one locale of skill, passive and theme text and the slim themes', async () => {
  const { readFileSync } = await import('node:fs')
  const page = readFileSync('app/[lang]/planner/community/[id]/page.tsx', 'utf8')
  expect(page).toContain("withoutOtherLocales(row, lang, ['name', 'description'])")
  expect(page).toMatch(/slimPlanThemes\(themes\.map\(theme => withoutOtherLocales\(theme, lang, \['name'\]\)\)/)
  expect(page).toContain('themes={planThemes}')
})

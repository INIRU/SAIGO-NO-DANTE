import { describe, expect, it } from 'vitest'
import { localize, parseLang, presentCatalogItem, presentDeck, presentPlan } from '@/features/account/lib/partner-api'

const skill = (order: number, uptie: number, atk: string, sin: string, extra: Record<string, unknown> = {}) => ({
  id: `s${order}-${uptie}`, name: `스킬${order}`, name_en: `Skill ${order}`, name_jp: null, skill_type: atk, atk_type: atk, sin_affinity: sin,
  coins: 2, base_power: 4, coin_power: 3, skill_order: order, variant_order: 0, uptie_level: uptie, image_id: null, atk_weight: 1, offense_level: 3, ...extra,
})
const identity = (id: string, sinner: string, skills: unknown[]) => ({
  id, sinner_id: sinner, game_id: '10101', folder_name: 'LCB Sinner', name: 'LCB Sinner', name_kr: 'LCB 수감자', name_en: 'LCB Sinner', name_jp: 'LCB囚人',
  rarity: 1, slash_res: 'normal', pierce_res: 'weak', blunt_res: 'resist', skills,
})
const first = identity('a', 'yi-sang', [skill(1, 3, 'slash', 'sloth'), skill(1, 4, 'pierce', 'sloth'), skill(2, 4, 'pierce', 'pride'), skill(3, 4, 'blunt', 'envy'), skill(4, 4, 'evade', 'envy', { atk_type: null })])
const second = identity('b', 'faust', [skill(1, 4, 'blunt', 'pride'), skill(2, 4, 'blunt', 'sloth'), skill(3, 4, 'blunt', 'gloom')])
const ego = { id: 'e1', sinner_id: 'yi-sang', name: 'Crow', name_kr: '오감도', name_en: "Crow's Eye View", name_jp: null, grade: 'ZAYIN', sin_affinity: 'sloth', image_url: 'https://img/ego.webp', cost: [0, 0, 2, 0, 0, 1, 0], ego_skills: [{ skill_type: 'slash', category: 'awakening', construe_level: 4, skill_order: 1 }] }

describe('partner API response shaping', () => {
  it('REQ-ACCOUNT-012 picks the requested language and falls back to Korean', () => {
    const row = { name: '화상', name_en: 'Burn', name_jp: '', nested: [{ description: '설명', description_en: 'Text', description_jp: '説明' }] }
    expect(localize(row, 'en')).toEqual({ name: 'Burn', nested: [{ description: 'Text' }] })
    expect(localize(row, 'ja')).toEqual({ name: '화상', nested: [{ description: '説明' }] })
    expect(localize({ name: 'Internal', name_kr: '이름', name_en: 'Name', name_jp: null }, 'ko')).toEqual({ name: '이름' })
    expect([parseLang(null), parseLang('ja'), parseLang('fr')]).toEqual(['ko', 'ja', null])
  })

  it('REQ-ACCOUNT-012 adds site, card and image addresses to catalog items', () => {
    const item = presentCatalogItem('identities', first, 'en') as Record<string, any>
    expect(item.name).toBe('LCB Sinner')
    expect(item.url).toMatch(/\/en\/sinners\/yi-sang\/identities\/a$/)
    expect(item.card_url).toBe(item.url + '/opengraph-image')
    expect(item.image_url).toContain('/sinners/yi-sang/identities/LCB%20Sinner/10101_normal_info.webp')
    expect(item.skills[0].icon_url).toContain('/icons/skills/yi-sang/1010101.webp')
    expect(item).not.toHaveProperty('name_kr')
    const egoItem = presentCatalogItem('egos', ego, 'ko') as Record<string, any>
    expect(egoItem.name).toBe('오감도')
    expect(egoItem.url).toMatch(/\/ko\/sinners\/yi-sang\/ego\/e1$/)
    // Other resources refer to a keyword by its Korean name, so it stays available as the key.
    expect(presentCatalogItem('keywords', { name: '화상', name_en: 'Burn', name_jp: null, max_stack: 99 }, 'en')).toEqual({ key: '화상', name: 'Burn', max_stack: 99 })
  })

  it('REQ-ACCOUNT-013 lists a deck in formation order with skills at each slot uptie and site analysis', () => {
    const deck = presentDeck({
      id: 'd1', title: '덱', lang: 'ko', vote_count: 3,
      deck_identities: [
        { slot_order: 99, uptie: 4, s1_count: 3, s2_count: 2, s3_count: 1, identity: second },
        { slot_order: 0, uptie: 3, s1_count: 4, s2_count: 1, s3_count: 1, identity: first },
      ],
      deck_egos: [{ grade: 'ZAYIN', ego }],
    }, 'en') as Record<string, any>
    expect(deck.url).toMatch(/\/en\/decks\/d1$/)
    expect(deck.card_url).toBe(deck.url + '/opengraph-image')
    expect(deck.formation.map((slot: any) => [slot.slot_order, slot.identity.id])).toEqual([[0, 'a'], [99, 'b']])
    expect(deck.formation[0]).toMatchObject({ uptie: 3, skill_counts: [4, 1, 1], identity: { name: 'LCB Sinner', sinner_id: 'yi-sang', resistances: { slash: 'normal', pierce: 'weak', blunt: 'resist' } } })
    // Uptie 3 slot: only the uptie 3 row exists at that level, so the uptie 4 rows are left out.
    expect(deck.formation[0].skills).toEqual([expect.objectContaining({ skill_order: 1, name: 'Skill 1', atk_type: 'slash', sin_affinity: 'sloth', coins: 2, base_power: 4, coin_power: 3 })])
    expect(deck.formation[1].skills.map((s: any) => s.atk_type)).toEqual(['blunt', 'blunt', 'blunt'])
    expect(deck.egos).toEqual([expect.objectContaining({ id: 'e1', grade: 'ZAYIN', name: "Crow's Eye View", sin_affinity: 'sloth', image_url: 'https://img/ego.webp' })])
    expect(deck.analysis.attack_types).toEqual({ slash: 2, pierce: 0, blunt: 3 })
    expect(deck.analysis.sin_production).toMatchObject({ sloth: 4 + 2, pride: 3, gloom: 1 })
    expect(deck.analysis.ego_cost).toMatchObject({ sloth: 2, pride: 1 })
    expect(deck).not.toHaveProperty('deck_identities')
  })

  it('REQ-ACCOUNT-013 resolves plan floors and inventory to named gifts and theme packs', () => {
    const plan = presentPlan({
      id: 'p1', title: '플랜', lang: 'ko', difficulty: 'hard',
      deck: [{ identity_id: 'b', slot_order: 1, s1_count: 3, s2_count: 2, s3_count: 1 }, { identity_id: 'a', slot_order: 0, s1_count: 3, s2_count: 2, s3_count: 1 }, { identity_id: 'gone', slot_order: 2 }],
      egos: [{ ego_id: 'e1', grade: 'ZAYIN' }],
      floor_plan: [{ floor: 1, theme_id: '1003', difficulty: 'hard', gift_ids: ['9079', '1'], memo: '메모', constraints: [] }],
      gift_inventory: ['observe_9079', 'final_9080_plusplus', '9080', 'blessing_3_2', 'bad', 'final_1'],
    }, {
      identities: [first, second], egos: [ego],
      themes: [{ id: 1003, name: '테마', name_en: 'Theme', name_jp: null, image_url: 'https://img/theme.webp' }],
      gifts: [{ id: 'g1', game_id: 9079, name: '기프트', name_en: 'Gift', name_jp: null, grade: 'II', keyword: '화상', image_url: 'https://img/g.webp' }, { id: 'g2', game_id: 9080, name: '둘', name_en: 'Two', name_jp: null, grade: 'III', keyword: '파열', image_url: null }],
    }, 'en') as Record<string, any>
    expect(plan.url).toMatch(/\/en\/planner\/community\/p1$/)
    expect(plan.formation.map((slot: any) => slot.identity.id)).toEqual(['a', 'b'])
    expect(plan.egos[0].name).toBe("Crow's Eye View")
    expect(plan.analysis.attack_types.blunt).toBe(4)
    expect(plan.floors).toEqual([{ floor: 1, difficulty: 'hard', memo: '메모', constraints: [], theme: { id: 1003, name: 'Theme', image_url: 'https://img/theme.webp' }, gifts: [{ game_id: 9079, name: 'Gift', grade: 'II', keyword: '화상', image_url: 'https://img/g.webp' }] }])
    expect(plan.gift_inventory).toEqual([
      { source: 'observe', enhancement: 0, game_id: 9079, name: 'Gift', grade: 'II', keyword: '화상', image_url: 'https://img/g.webp' },
      { source: 'final', enhancement: 2, game_id: 9080, name: 'Two', grade: 'III', keyword: '파열', image_url: null },
      { source: null, enhancement: 0, game_id: 9080, name: 'Two', grade: 'III', keyword: '파열', image_url: null },
    ])
    expect(plan.blessings).toEqual([{ id: 3, level: 2 }])
    expect(plan).not.toHaveProperty('floor_plan')
  })
})

import { describe, expect, it } from 'vitest'
import { trimDeckIdentity } from '../../../lib/decks/trim-deck-identity'

const skill = (order: number, uptie: number) => ({
  id: `s${order}-${uptie}`, name: '베기', name_en: 'Slash', name_jp: '斬る', skill_order: order, variant_order: 1, uptie_level: uptie,
  description: `ko${uptie}`, description_en: `en${uptie}`, description_jp: `jp${uptie}`,
})
const passive = (order: number, uptie: number) => ({
  name: '패시브', name_en: 'P', name_jp: 'P-jp', passive_type: 'battle', passive_order: order, uptie_level: uptie,
  description: `ko${uptie}`, description_en: `en${uptie}`, description_jp: null,
})
const identity = {
  id: 'i1', name_kr: '이름',
  skills: [1, 2, 3, 4].flatMap(u => [skill(1, u), skill(2, u)]),
  passives: [1, 2, 3, 4].map(u => passive(1, u)),
}

describe('trimDeckIdentity', () => {
  it('keeps the highest uptie row per skill/passive plus the slot uptie row, nothing else', () => {
    const out = trimDeckIdentity(identity, 2, 'ko')
    expect(out.skills.map(s => s.uptie_level).sort()).toEqual([2, 2, 4, 4])
    expect(out.passives.map(p => p.uptie_level).sort()).toEqual([2, 4])
  })

  it('keeps only the top row when the slot uptie is 4', () => {
    const out = trimDeckIdentity(identity, 4, 'ko')
    expect(out.skills).toHaveLength(2)
    expect(out.passives).toHaveLength(1)
  })

  it('falls back to the nearest available level like rowsAtUptie', () => {
    const sparse = { ...identity, skills: [skill(1, 1), skill(1, 4)], passives: [] }
    expect(trimDeckIdentity(sparse, 2, 'ko').skills.map(s => s.uptie_level).sort()).toEqual([1, 4])
    expect(trimDeckIdentity(sparse, 3, 'ko').skills.map(s => s.uptie_level)).toEqual([4])
  })

  it('collapses descriptions to the localized text so other languages are not sent', () => {
    const ko = trimDeckIdentity(identity, 4, 'ko').skills[0]
    expect(ko.description).toBe('ko4')
    expect(ko).not.toHaveProperty('description_en')
    expect(ko).not.toHaveProperty('description_jp')
    expect(trimDeckIdentity(identity, 4, 'en').skills[0].description).toBe('en4')
    // jp missing falls back en -> ko, same chain as localizePassiveDescription
    expect(trimDeckIdentity(identity, 4, 'ja').passives[0].description).toBe('en4')
  })

  it('keeps names in every language (notes match by any of them)', () => {
    const out = trimDeckIdentity(identity, 4, 'ko').skills[0]
    expect(out.name_en).toBe('Slash')
    expect(out.name_jp).toBe('斬る')
  })
})

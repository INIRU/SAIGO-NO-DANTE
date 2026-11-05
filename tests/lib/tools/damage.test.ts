import { describe, expect, it } from 'vitest'
import { clampModifierValue, coinChoices, coinDamage, coinModifiers, coinPowers, GIFT_IMAGE_BASE, MAX_MODIFIER_NAME, MAX_MODIFIERS, parseNumberInput, parseSavedModifiers, toModifier, type DamageInput } from '@/lib/tools/damage'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const base: DamageInput = { power: 10, offenseLevel: 50, defenseLevel: 50, physicalResist: 1, sinResist: 1 }
const damage = (input: Partial<DamageInput>) => coinDamage({ ...base, ...input }).damage

describe('damage calculator', () => {
  // The game's worked examples (game values): every coin is figured in 32-bit floats, in the game's order.
  describe('REQ-TOOLS-014 the game formula', () => {
    const game = (input: Partial<DamageInput>) => coinDamage({ ...base, offenseLevel: 60, defenseLevel: 50, ...input }).damage
    it('REQ-TOOLS-014 example 1: a weak physical resistance and a level gap', () => {
      expect(game({ physicalResist: 2 })).toBe(22)
    })
    it('REQ-TOOLS-014 example 2: three stacks of damage up multiply the whole hit', () => {
      expect(game({ physicalResist: 2, modifiers: [{ target: 'damage', value: 0.3 }] })).toBe(29)
    })
    it('REQ-TOOLS-014 example 3: a flat damage adder is weighed by the resistances and the level gap alone', () => {
      expect(game({ physicalResist: 2, damageAdder: 5 })).toBe(34)
      expect(game({ physicalResist: 2, hpAdder: 5 })).toBe(27)
    })
    it('REQ-TOOLS-014 example 4: ten stacks of protection leave the least damage (5% of the power)', () => {
      expect(damage({ power: 40, physicalResist: 0.5, sinResist: 0, modifiers: [{ target: 'damage', value: -1 }] })).toBe(2)
      expect(damage({ power: 40, physicalResist: 0.5, sinResist: 0 })).toBe(10)
    })
    it('REQ-TOOLS-014 example 5: 100 power with +15% is 115 in 32-bit floats', () => {
      expect(damage({ power: 100, modifiers: [{ target: 'damage', value: 0.15 }] })).toBe(115)
    })
    it('REQ-TOOLS-014 example 6: a critical hit adds 0.2 times its passives, clashes 3% each', () => {
      expect(damage({ power: 20, critical: true })).toBe(24)
      expect(damage({ power: 20, critical: true, clashCount: 5 })).toBe(27)
      expect(damage({ power: 20, critical: true, critAdder: 0.1 })).toBe(26)
      expect(damage({ power: 20, critical: true, critPassive: 0.5 })).toBe(26)
    })
    it('REQ-TOOLS-014 example 7: staggered+ with 0.3 weakening is 2.8, over the normal cap', () => {
      expect(damage({ power: 12, stagger: 2, modifiers: [{ target: 'physical', value: 0.3 }] })).toBe(33)
    })
    it('REQ-TOOLS-014 holds the physical resistance between −2 and 2 when not staggered', () => {
      expect(damage({ physicalResist: 2, modifiers: [{ target: 'physical', value: 0.3 }] })).toBe(20)
      // Below 0 the resistance counts as −0.5, the same as 0.
      expect(damage({ physicalResist: 0.5, modifiers: [{ target: 'physical', value: -1 }] })).toBe(damage({ physicalResist: 0 }))
    })
  })
  it('REQ-TOOLS-007 matches the worked example (W Don Quixote against a staggered+ enemy)', () => {
    expect(damage({ power: 8, offenseLevel: 53, defenseLevel: 19, stagger: 2, sinResist: 0.75, observationLevel: 1 })).toBe(23)
  })
  it('REQ-TOOLS-007 adds both resistances and halves a reduction below normal', () => {
    expect(damage({ physicalResist: 2, sinResist: 2 })).toBe(30)
    expect(damage({ physicalResist: 0.5, sinResist: 0.5 })).toBe(5)
    expect(damage({ physicalResist: 0.5, sinResist: 2 })).toBe(17)
  })
  it('REQ-TOOLS-007 fixes the physical resistance by stagger stage', () => {
    expect([0, 1, 2, 3].map(stagger => damage({ physicalResist: 0.5, stagger: stagger as 0 | 1 | 2 | 3 }))).toEqual([7, 20, 25, 30])
  })
  it('REQ-TOOLS-007 scales with the level difference in both directions', () => {
    expect(damage({ offenseLevel: 55 })).toBe(11)
    expect(damage({ defenseLevel: 55 })).toBe(8)
  })
  it('REQ-TOOLS-007 adds critical, clash count and observation level beside the resistances', () => {
    expect(damage({ critical: true })).toBe(12)
    expect(damage({ clashCount: 4 })).toBe(11)
    expect(damage({ observationLevel: 4 })).toBe(11)
    expect(damage({ critical: true, physicalResist: 2 })).toBe(22)
  })
  it('REQ-TOOLS-007 uses 20% for a critical hit and 3% for each clash and observation level', () => {
    expect(damage({ power: 100, critical: true })).toBe(120)
    expect(damage({ power: 100, clashCount: 1 })).toBe(103)
    expect(damage({ power: 100, observationLevel: 1 })).toBe(103)
  })
  it('REQ-TOOLS-007 never lets reductions on both sides multiply into more damage', () => {
    // Damage modifiers at −150% and a resistance side below zero: two negative factors would give +5.
    expect(damage({ power: 100, offenseLevel: 20, defenseLevel: 60, physicalResist: 0.5, sinResist: 0.5, modifiers: [{ target: 'damage', value: -1.5 }] })).toBe(5)
    expect(damage({ power: 100, modifiers: [{ target: 'damage', value: -3 }, { target: 'resist', value: -3 }] })).toBe(5)
    // The game does not stop the damage sum at 0; the least damage takes over below it.
    expect(coinDamage({ ...base, modifiers: [{ target: 'damage', value: -3 }] }).damageFactor).toBe(-2)
    expect(damage({ modifiers: [{ target: 'damage', value: -3 }] })).toBe(1)
  })
  it('REQ-TOOLS-007 floors the result, never below 1, without losing a point to binary fractions', () => {
    expect(damage({ power: 1, modifiers: [{ target: 'damage', value: -1 }] })).toBe(1)
    expect(damage({ power: 0 })).toBe(1)
    expect(damage({ power: 100, modifiers: [{ target: 'damage', value: 0.15 }] })).toBe(115)
  })
  it('REQ-TOOLS-007 rejects invalid input', () => {
    for (const input of [{ power: -1 }, { power: NaN }, { offenseLevel: 1.5 }, { defenseLevel: -1 }, { physicalResist: -0.5 }, { sinResist: NaN }, { clashCount: -1 }, { observationLevel: 0.5 }, { stagger: 4 as 3 }, { stagger: 'length' as unknown as 3 }]) {
      expect(() => coinDamage({ ...base, ...input })).toThrow()
    }
  })
  it('REQ-TOOLS-007 builds each coin power from the base power and the heads so far', () => {
    expect(coinPowers(4, 4, [true, true, false])).toEqual([8, 12, 12])
    expect(coinPowers(20, -4, [true, false])).toEqual([16, 16])
    expect(coinPowers(2, -4, [true])).toEqual([0])
  })
  it('REQ-TOOLS-008 puts each custom modifier where it applies', () => {
    // Protection 2 and two gifts (+10%, +15%) on a staggered enemy that resists the sin: 6 × 1.05 × 2.125.
    expect(damage({ power: 6, offenseLevel: 57, defenseLevel: 42, stagger: 1, sinResist: 0.5, modifiers: [{ target: 'damage', value: -0.2 }, { target: 'damage', value: 0.1 }, { target: 'damage', value: 0.15 }] })).toBe(13)
    expect(damage({ modifiers: [{ target: 'resist', value: 0.3 }] })).toBe(13)
    expect(damage({ modifiers: [{ target: 'damage', value: 0.5 }, { target: 'resist', value: 0.2 }] })).toBe(18)
  })
  it('REQ-TOOLS-008 applies a final multiplier after the damage is floored', () => {
    expect(damage({ modifiers: [{ target: 'final', value: 2 }] })).toBe(20)
    expect(damage({ power: 8, offenseLevel: 53, defenseLevel: 19, stagger: 2, sinResist: 0.75, modifiers: [{ target: 'final', value: 2 }] })).toBe(46)
    expect(() => damage({ modifiers: [{ target: 'final', value: -1 }] })).toThrow()
    // The minimum of 1 holds after the multiplier too.
    expect(damage({ modifiers: [{ target: 'final', value: 0 }] })).toBe(1)
    expect(damage({ power: 0, modifiers: [{ target: 'final', value: 0.5 }] })).toBe(1)
    expect(() => damage({ modifiers: [{ target: 'damage', value: NaN }] })).toThrow()
  })
  it('REQ-TOOLS-011 raises a resistance by a weakening before the resistance is weighed', () => {
    // ×0.5 weakened by 0.3 is ×0.8: −10%, not −25% + 30%.
    expect(damage({ power: 100, physicalResist: 0.5, modifiers: [{ target: 'physical', value: 0.3 }] })).toBe(90)
    expect(damage({ power: 100, sinResist: 1, modifiers: [{ target: 'sin', value: 0.3 }] })).toBe(130)
    // A staggered target's physical resistance is 2 + (stage − 1) × 0.5 plus the weakening.
    expect(damage({ power: 100, stagger: 1, modifiers: [{ target: 'physical', value: 0.3 }] })).toBe(230)
    expect(damage({ power: 100, stagger: 3, modifiers: [{ target: 'physical', value: 0.2 }] })).toBe(320)
    expect(damage({ power: 100, stagger: 2, physicalResist: 0.5, modifiers: [{ target: 'physical', value: 0.5 }] })).toBe(300)
  })
  it('REQ-TOOLS-011 holds a sin resistance between 0 and 2', () => {
    // Typed above 2, or raised past 2 by a weakening, it counts as 2: 100 × (1 + 1 + 1).
    expect(damage({ power: 100, sinResist: 10 })).toBe(damage({ power: 100, sinResist: 2 }))
    expect(damage({ power: 100, sinResist: 10 })).toBe(200)
    expect(damage({ power: 100, sinResist: 1.5, modifiers: [{ target: 'sin', value: 1 }] })).toBe(200)
    // The weakening is added first and the sum is held to 0–2 (game values): 10 − 0.5 is still 2.
    expect(damage({ power: 100, sinResist: 10, modifiers: [{ target: 'sin', value: -0.5 }] })).toBe(200)
    expect(damage({ power: 100, sinResist: 2, modifiers: [{ target: 'sin', value: -0.5 }] })).toBe(150)
    expect(damage({ power: 100, sinResist: 0.5, modifiers: [{ target: 'sin', value: -2 }] })).toBe(50)
  })
  it('REQ-TOOLS-007 never goes under 5% of the coin power, rounded down, or 1', () => {
    expect(damage({ power: 100, modifiers: [{ target: 'damage', value: -1 }] })).toBe(5)
    expect(damage({ power: 59, modifiers: [{ target: 'damage', value: -1 }] })).toBe(2)
    expect(damage({ power: 19, modifiers: [{ target: 'damage', value: -1 }] })).toBe(1)
    // Above the minimum the ordinary result stands.
    expect(damage({ power: 100, modifiers: [{ target: 'damage', value: -0.5 }] })).toBe(50)
    // The final multiplier meets the raised minimum.
    expect(damage({ power: 100, modifiers: [{ target: 'damage', value: -1 }, { target: 'final', value: 2 }] })).toBe(10)
  })
  it('REQ-TOOLS-008 keeps a typed value inside the range of its target', () => {
    expect(clampModifierValue(-5000, 'damage')).toBe(-1000)
    expect(clampModifierValue(5000, 'resist')).toBe(1000)
    expect(clampModifierValue(-20, 'damage')).toBe(-20)
    expect(clampModifierValue(-2, 'final')).toBe(0)
    expect(clampModifierValue(-0.3, 'physical')).toBe(-0.3)
  })
  it('REQ-TOOLS-007 reads a number as it is typed and waits while it is not one yet', () => {
    const range = { min: -99, max: 99 }
    expect(parseNumberInput('-4', range)).toBe(-4)
    expect(parseNumberInput('012', range)).toBe(12)
    expect(parseNumberInput('150', range)).toBe(99)
    expect(parseNumberInput('1.7', range)).toBe(1)
    expect(parseNumberInput('.5', { min: 0, max: 10, decimal: true })).toBe(0.5)
    // An emptied field, or a lone "-" (a number field reports it as empty), changes nothing yet.
    for (const raw of ['', '-', 'abc', 'Infinity']) expect(parseNumberInput(raw, range)).toBeNull()
  })
  it('REQ-TOOLS-008 reads saved custom modifiers and drops damaged ones', () => {
    const saved = [{ id: 1, name: '형님의 시련', value: 2, target: 'final' }, { id: 2, name: '환상통', value: 15, target: 'damage' }]
    expect(parseSavedModifiers(JSON.stringify(saved))).toEqual(saved)
    expect(parseSavedModifiers(JSON.stringify([...saved, { id: 3, name: 'x', value: 'NaN', target: 'damage' }, { id: 4, name: 'x', value: 1, target: 'other' }, null, { id: 2, name: 'again', value: 1, target: 'resist' }, { id: 5, name: 'x', value: -1, target: 'final' }]))).toEqual(saved)
    expect(parseSavedModifiers(JSON.stringify([{ id: 1, name: 'n'.repeat(80), value: 9999, target: 'damage' }]))).toEqual([{ id: 1, name: 'n'.repeat(MAX_MODIFIER_NAME), value: 1000, target: 'damage' }])
    expect(parseSavedModifiers(JSON.stringify(Array.from({ length: 80 }, (_, id) => ({ id, name: '', value: 1, target: 'damage' }))))).toHaveLength(MAX_MODIFIERS)
    for (const raw of [null, '', '{', '{"a":1}', '"text"']) expect(parseSavedModifiers(raw)).toEqual([])
    expect(parseSavedModifiers(JSON.stringify([{ id: 2 ** 60, name: 'x', value: 1, target: 'damage' }, { id: 3, name: '참격 내성 약화 3', value: 0.3, target: 'physical' }]))).toEqual([{ id: 3, name: '참격 내성 약화 3', value: 0.3, target: 'physical' }])
  })
  it('REQ-TOOLS-013 applies a modifier set to one coin to that coin only', () => {
    const saved = [
      { id: 1, name: '피해량 증가', value: 50, target: 'damage' as const },
      { id: 2, name: '마지막 코인', value: 100, target: 'damage' as const, coin: 3 },
      { id: 3, name: '추가 피해', value: 1.5, target: 'final' as const, coin: 3 },
    ]
    expect(coinModifiers(saved, 1)).toEqual([{ target: 'damage', value: 0.5 }])
    expect(coinModifiers(saved, 3)).toEqual([{ target: 'damage', value: 0.5 }, { target: 'damage', value: 1 }, { target: 'final', value: 1.5 }])
    // 10 × 1.5 on the first two coins; 10 × 2.5 = 25, then × 1.5 and floored, on the third.
    expect([1, 2, 3].map(coin => coinDamage({ ...base, modifiers: coinModifiers(saved, coin) }).damage)).toEqual([15, 15, 37])
    // The coin is saved with the modifier; a coin that is not one of the ten is dropped, and the modifier is for every coin again.
    expect(parseSavedModifiers(JSON.stringify(saved))).toEqual(saved)
    for (const coin of [0, 11, 2.5, '3', null]) expect(parseSavedModifiers(JSON.stringify([{ ...saved[1], coin }]))).toEqual([{ id: 2, name: '마지막 코인', value: 100, target: 'damage' }])
    // The choices are every coin (0) and the coins the skill has; a saved coin the skill no longer has stays as the last choice, without the ones between.
    expect(coinChoices(3)).toEqual([0, 1, 2, 3])
    expect(coinChoices(3, 2)).toEqual([0, 1, 2, 3])
    expect(coinChoices(1, 3)).toEqual([0, 1, 3])
    for (const copy of [ko, en, ja] as unknown as Array<{ damage: Record<string, string> }>) {
      for (const key of ['customCoin', 'coinAll', 'coinMissing']) expect(copy.damage[key]).toBeTruthy()
      // Two fields of one row are not called the same.
      expect(copy.damage.customCoin).not.toBe(copy.damage.customTarget)
    }
  })
  it('REQ-TOOLS-012 keeps where a picked modifier came from, and drops only the damaged parts of it', () => {
    const picked = [
      { id: 1, name: '취약', value: 30, target: 'damage', keyword: '취약', stacks: 3, side: 'target' },
      { id: 2, name: '미적 감각++', value: 50, target: 'damage', options: [50, 10], gift: { id: '9065', level: 2, image_url: `${GIFT_IMAGE_BASE}ego-gifts/a.webp`, grade: '4', keyword: 'Sinking' } },
      { id: 3, name: '주시', value: 20, target: 'damage', keyword: '주시', options: [20] },
    ]
    expect(parseSavedModifiers(JSON.stringify(picked))).toEqual(picked)
    expect(parseSavedModifiers(JSON.stringify([
      { id: 1, name: '취약', value: 30, target: 'damage', keyword: 7, stacks: 3.5 },
      { id: 2, name: 'g', value: 50, target: 'damage', options: [50, 'x'], gift: { id: 9065, level: 2 } },
      { id: 3, name: 'g', value: 1, target: 'damage', options: Array(40).fill(1), gift: { id: '1', level: 5, image_url: null, grade: null, keyword: null } },
      { id: 4, name: 'g', value: 1, target: 'damage', gift: { id: '1', level: 1, image_url: null, grade: null, keyword: null }, stacks: 0, side: 'enemy' },
    ]))).toEqual([
      { id: 1, name: '취약', value: 30, target: 'damage' },
      { id: 2, name: 'g', value: 50, target: 'damage' },
      { id: 3, name: 'g', value: 1, target: 'damage' },
      { id: 4, name: 'g', value: 1, target: 'damage', gift: { id: '1', level: 1, image_url: null, grade: null, keyword: null } },
    ])
  })
  it('REQ-TOOLS-012 does not let a saved value break the page that draws it', () => {
    const gift = { id: '9065', level: 2, image_url: null, grade: '4', keyword: 'Sinking' }
    const row = (extra: object) => parseSavedModifiers(JSON.stringify([{ id: 1, name: 'a', value: 10, target: 'damage', ...extra }]))[0]
    // Names that every object answers to are not keywords or grades.
    for (const key of ['constructor', '__proto__', 'toString']) {
      expect(row({ keyword: key })).toEqual({ id: 1, name: 'a', value: 10, target: 'damage' })
      expect(row({ gift: { ...gift, grade: key } }).gift).toBeUndefined()
      expect(row({ gift: { ...gift, keyword: key } }).gift).toBeUndefined()
    }
    // Artwork comes from the site's own storage only.
    for (const url of ['javascript:alert(1)', 'https://evil.example/x.png', '//evil.example/x.png', 'not a url', '', `${GIFT_IMAGE_BASE}../../x.png`]) expect(row({ gift: { ...gift, image_url: url } }).gift).toBeUndefined()
    expect(row({ gift }).gift).toEqual(gift)
    // A choice is held to the same range as a typed value: a final multiplier is never negative.
    expect(parseSavedModifiers(JSON.stringify([{ id: 1, name: 'f', value: 1, target: 'final', options: [-1, 2] }]))[0].options).toEqual([0, 2])
    expect(row({ options: [5000, -20] }).options).toEqual([1000, -20])
    // An id the next id could not follow is dropped with its row.
    expect(parseSavedModifiers(JSON.stringify([{ id: Number.MAX_SAFE_INTEGER, name: 'a', value: 1, target: 'damage' }, { id: -1, name: 'a', value: 1, target: 'damage' }]))).toEqual([])
  })
  it('REQ-TOOLS-008 hands a saved percent to the calculation as a fraction, and the other units as they are', () => {
    const saved = { id: 1, name: 'a' }
    expect(toModifier({ ...saved, value: 25, target: 'damage' })).toEqual({ target: 'damage', value: 0.25 })
    expect(toModifier({ ...saved, value: -30, target: 'resist' })).toEqual({ target: 'resist', value: -0.3 })
    expect(toModifier({ ...saved, value: 2, target: 'final' })).toEqual({ target: 'final', value: 2 })
    expect(toModifier({ ...saved, value: 0.3, target: 'physical' })).toEqual({ target: 'physical', value: 0.3 })
    expect(toModifier({ ...saved, value: 0.2, target: 'sin' })).toEqual({ target: 'sin', value: 0.2 })
    // Whatever the saved value, the calculation is handed one it accepts: a final multiplier is never negative.
    expect(toModifier({ ...saved, value: -40, target: 'final' })).toEqual({ target: 'final', value: 0 })
    expect(() => coinDamage({ ...base, modifiers: [toModifier({ ...saved, value: -40, target: 'final' })] })).not.toThrow()
  })
  it('REQ-TOOLS-008 reports the factors it multiplied', () => {
    const result = coinDamage({ ...base, offenseLevel: 55, modifiers: [{ target: 'damage', value: 0.25 }, { target: 'final', value: 2 }] })
    expect(result.damageFactor).toBeCloseTo(1.25)
    expect(result.resistFactor).toBeCloseTo(1 + 5 / 30)
    expect(result.finalMultiplier).toBe(2)
  })
})

const keys = (value: unknown, path = ''): string[] => typeof value === 'object' && value
  ? Object.entries(value).flatMap(([key, child]) => keys(child, path ? `${path}.${key}` : key))
  : [path]

describe('damage calculator copy', () => {
  it('REQ-TOOLS-009 has the same calculator and menu copy in Korean, English and Japanese', () => {
    const copies = [ko, en, ja] as unknown as Array<{ damage?: Record<string, unknown>; nav: { tools: Record<string, string> } }>
    const [koKeys, enKeys, jaKeys] = copies.map(copy => keys(copy.damage).sort())
    expect(koKeys.length).toBeGreaterThan(20)
    expect(enKeys).toEqual(koKeys)
    expect(jaKeys).toEqual(koKeys)
    for (const copy of copies) {
      expect(copy.nav.tools.damage).toBeTruthy()
      for (const key of koKeys) expect(key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], copy.damage)).not.toBe('')
    }
    // Translated, not copied from the Korean file.
    expect(copies[1].nav.tools.damage).not.toBe(copies[0].nav.tools.damage)
    expect(copies[2].nav.tools.damage).not.toBe(copies[0].nav.tools.damage)
  })
})

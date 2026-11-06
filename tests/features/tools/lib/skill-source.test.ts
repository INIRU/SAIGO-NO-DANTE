import { describe, expect, it } from 'vitest'
import { buildEgoSkills, buildIdentitySkills, toDamageSkill, type ToolSkill } from '@/features/tools/lib/skill-source'

const row = (over: Record<string, unknown>) => ({
  id: 's', identity_id: 'i', name: '스킬', name_en: 'Skill', name_jp: null, skill_type: 'slash', atk_type: 'slash', sin_affinity: 'wrath',
  coins: 2, base_power: 4, coin_power: 3, coin_list: null, skill_order: 1, variant_order: 1, uptie_level: 4, offense_level: 62, image_id: null, ...over,
})

describe('identity skills for the calculators', () => {
  it('keeps the highest uptie of every slot and variant, in slot order, with the game frame and sprite', () => {
    const skills = buildIdentitySkills({ sinner_id: 'rodion', game_id: '10902' }, [
      row({ id: 'a3', skill_order: 1, uptie_level: 3, base_power: 3 }),
      row({ id: 'a4', skill_order: 1, uptie_level: 4, base_power: 4 }),
      row({ id: 'g4', skill_order: 4, skill_type: 'counter', atk_type: 'slash', sin_affinity: 'envy' }),
      row({ id: 'b4', skill_order: 2, atk_type: 'pierce', sin_affinity: 'lust' }),
    ], 'en')
    expect(skills.map(skill => skill.key)).toEqual(['a4', 'b4', 'g4'])
    expect(skills[0]).toMatchObject({ name: 'Skill', slot: 1, sin: 'wrath', atk: 'slash', base_power: 4 })
    expect(skills[0].icon).toContain('/icons/skills/rodion/1090201.webp')
    expect(skills[2]).toMatchObject({ slot: 4, defense: true, sin: 'envy' })
  })
})

describe('E.G.O skills for the calculators', () => {
  it('keeps the highest threadspin of awakening then corrosion, with the E.G.O portrait as the sprite', () => {
    const skills = buildEgoSkills({ image_url: 'https://x/sinners/yi-sang/ego/Sunshower/20101_awaken_profile.webp' }, [
      { id: 'c4', category: 'corrosion', construe_level: 4, name: '침식', name_en: null, name_jp: null, skill_type: 'blunt', sin_affinity: 'gloom', coins: 4, base_power: 3, coin_power: 6, coin_list: null, offense_level: 65 },
      { id: 'a1', category: 'awakening', construe_level: 1, name: '각성', name_en: null, name_jp: null, skill_type: 'pierce', sin_affinity: 'sloth', coins: 3, base_power: 4, coin_power: 4, coin_list: null, offense_level: 62 },
      { id: 'a4', category: 'awakening', construe_level: 4, name: '각성', name_en: null, name_jp: null, skill_type: 'pierce', sin_affinity: 'sloth', coins: 3, base_power: 5, coin_power: 4, coin_list: null, offense_level: 62 },
    ], 'ko')
    expect(skills.map(skill => skill.key)).toEqual(['a4', 'c4'])
    expect(skills[0]).toMatchObject({ slot: 3, atk: 'pierce', sin: 'sloth', base_power: 5, corrosion: false })
    expect(skills[1].icon).toBe('https://x/sinners/yi-sang/ego/Sunshower/20101_erosion_profile.webp')
    expect(skills[1].corrosion).toBe(true)
  })
})

describe('a skill in the damage calculator', () => {
  const skill: ToolSkill = { key: 'k', name: 'n', sin: 'gloom', slot: 2, atk: 'blunt', defense: false, corrosion: false, icon: '', coins: 12, base_power: 5, coin_power: 7, coin_list: null, offense_level: 63 }
  it('fills the power, coins (up to the calculator\'s limit), the level-65 attack level, the sin and the attack type', () => {
    expect(toDamageSkill(skill, 5)).toEqual({ basePower: 5, coinPower: 7, coinCount: 5, offenseLevel: 68, skillSin: 'AZURE', skillAtk: 'HIT' })
  })
  it('leaves the sin and attack type unpicked when the skill has none', () => {
    expect(toDamageSkill({ ...skill, sin: null, atk: null, offense_level: null, coins: 0 }, 5)).toMatchObject({ skillSin: '', skillAtk: '', offenseLevel: 65, coinCount: 1 })
  })
})

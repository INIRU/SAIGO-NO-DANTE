import { expect, it } from 'vitest'
import { egoDrift } from './ego-drift'

const skill = (category: string, level: number, base = 15) => ({ id: `${category}${level}`, game_skill_id: category === 'awakening' ? 2010611 : 2010621, category, construe_level: level, sin_affinity: 'gloom', skill_type: 'pierce', base_power: base, coin_power: 8, coins: 1, name: '지난 날', description: 'x' })
const ego = { grade: 'ZAYIN', sin_affinity: 'gloom', cost: [0, 0, 3, 0, 3, 0, 0], keywords: ['속박', '침잠'], passive_name: '조각난 어제' }
const plan = { ego, skills: [skill('awakening', 1), skill('corrosion', 1, 22)], passives: [{ ego_id: 'e', game_passive_id: 2010611, name: '조각난 어제' }] }

it('reports nothing when the DB equals the extraction, whatever the row ids or keyword order', () => {
  const db = { ego: { ...ego, keywords: ['침잠', '속박'], release_date: '2024-04-04' }, skills: plan.skills.map(row => ({ ...row, id: 'other' })).reverse(), passives: [...plan.passives] }
  expect(egoDrift(plan, db)).toEqual([])
})

it('flags data copied from another EGO, changed text and missing or extra rows', () => {
  const copied = { ego: { ...ego, sin_affinity: 'sloth', passive_name: '비 갠 뒤 햇살' }, skills: [{ ...skill('awakening', 1), name: '여우비' }, skill('corrosion', 1, 22)], passives: [{ ego_id: 'e', game_passive_id: 2010511, name: '비 갠 뒤 햇살' }] }
  expect(egoDrift(plan, copied)).toEqual(['sin_affinity', 'passive_name', 'skills', 'passives'])
  expect(egoDrift(plan, { ...plan, skills: [...plan.skills, skill('awakening', 2)] })).toEqual(['skills'])
  expect(egoDrift(plan, { ...plan, passives: [] })).toEqual(['passives'])
})

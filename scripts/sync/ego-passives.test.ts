import { expect, it } from 'vitest'
import { passiveStageRange } from './ego-passives'
import { egoPassiveAtStage } from '../../lib/ego/stages'
import type { EGO } from '../../lib/types'
it('switches mutually exclusive passive variants at V and locks them before II', () => {
  const ego = { stage_passives: [
    { ...passiveStageRange(['CheckAwakenLevelBetween_2_4']), name:'before', description:'old' },
    { ...passiveStageRange(['CheckAwakenLevel5']), name:'after', description:'new' },
  ] } as EGO
  expect(egoPassiveAtStage(ego,1).passive_name).toBe('')
  expect(egoPassiveAtStage(ego,4).passive_content).toBe('old')
  expect(egoPassiveAtStage(ego,5).passive_content).toBe('new')
  expect(passiveStageRange(['CheckAwakenLevel2'])).toEqual({min_stage:2,max_stage:5})
  expect(()=>passiveStageRange(['unknown'])).toThrow('Unknown')
})

import { describe, expect, it } from 'vitest'
import type { EGO } from '@/lib/types'
import { egoPassiveAtStage } from '@/features/catalog/lib/ego-stages'

const passive = (over: Record<string, unknown>) => ({ name: 'n', min_stage: 1, max_stage: 5, description: '', ...over })

describe('egoPassiveAtStage (REQ-SHARED-020)', () => {
  it('REQ-SHARED-020 closes the tags of one passive before the next, so a highlight never runs on into it', () => {
    const ego = { stage_passives: [
      passive({ description: '<style="highlight">- 가', description_en: '<style="highlight">- a' }),
      passive({ description: '나', description_en: 'b' }),
    ] } as unknown as EGO
    const shown = egoPassiveAtStage(ego, 3)
    expect(shown.passive_content).toBe('<style="highlight">- 가</style>\n\n나')
    expect(shown.passive_content_en).toBe('<style="highlight">- a</style>\n\nb')
  })

  it('REQ-SHARED-020 joins the older text as before and picks the passives of the stage', () => {
    const ego = { stage_passives: [
      passive({ description: '가' }),
      passive({ description: '나', min_stage: 4 }),
      passive({ description: '다', description_en: null }),
    ] } as unknown as EGO
    expect(egoPassiveAtStage(ego, 2).passive_content).toBe('가\n\n다')
    expect(egoPassiveAtStage(ego, 2).passive_content_en).toBe('가\n\n다')
  })
})

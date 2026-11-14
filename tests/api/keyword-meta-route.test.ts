import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getKeywordData: vi.fn() }))
vi.mock('@/lib/keywords/server-data', () => ({ getKeywordData: mocks.getKeywordData }))

import { GET } from '@/app/api/keyword-meta/route'

describe('/api/keyword-meta serves the same descriptions as the catalogue', () => {
  beforeEach(() => { mocks.getKeywordData.mockReset() })

  it('lists name, description, max_stack and effect_type from the catalogue (descriptions from the references)', async () => {
    mocks.getKeywordData.mockResolvedValue({
      호흡: { desc: '크리티컬 확률 증가', maxStack: 20, effectType: 'positive' },
      화상: { desc: '참조 표의 설명', effectType: 'negative' },
      빈것: { desc: '' },
    })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { name: '빈것', description: null, max_stack: null, effect_type: null },
      { name: '호흡', description: '크리티컬 확률 증가', max_stack: 20, effect_type: 'positive' },
      { name: '화상', description: '참조 표의 설명', max_stack: null, effect_type: 'negative' },
    ])
  })

  it('answers 500 when the catalogue cannot be read', async () => {
    mocks.getKeywordData.mockRejectedValue(new Error('down'))
    const response = await GET()
    expect(response.status).toBe(500)
  })
})

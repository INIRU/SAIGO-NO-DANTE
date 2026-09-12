import { describe, expect, it } from 'vitest'
import { getEventOutcomes } from '@/lib/utils/event-outcomes'

describe('event judgment outcomes', () => {
  it('preserves every success and failure variant from the source importer', () => {
    const rows = [
      { sort_order: 0, message: '성공 1' }, { sort_order: 1, message: '성공 1' },
      { sort_order: 100, message: '성공 2' }, { sort_order: 200, message: '실패 1' },
      { sort_order: 201, message: '실패 1' }, { sort_order: 300, message: '실패 2' },
    ]
    expect(getEventOutcomes(rows).map(row => row.kind)).toEqual(['success', 'success', 'success', 'failure', 'failure', 'failure'])
  })
  it('recognizes all UI languages and keeps unknown outcomes neutral', () => {
    expect(getEventOutcomes([
      { sort_order: 100, message: 'Failure' }, { sort_order: 0, message: 'Success' },
      { sort_order: 200, message: '成功 2' }, { sort_order: 300, message: '失敗' },
      { sort_order: 400, message: '다른 결과' },
    ]).map(row => row.kind)).toEqual(['success', 'failure', 'success', 'failure', 'other'])
  })
})

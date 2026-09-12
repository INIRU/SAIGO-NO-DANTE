import { expect, it } from 'vitest'
import { sourceResultText, sourceResults, walkEventGraph, type SourceEvent } from './mirror-event-source'

it('traverses grandchildren, cross-links and retries without turning them into entries', () => {
  const nodes: SourceEvent[] = [
    { id: 1, eventType: 'EVENT', actionEvent: { eachOptionList: [{ index: 0, resultList: [{ resultIndex: 0, nextEventID: 2 }] }] } },
    { id: 2, eventType: 'COIN_EVENT', personalityEvent: { eventResults: [{ eventResult: 'SUCCESS', eventResultDataList: [{ resultIndex: 0, nextEventID: 3 }] }] } },
    { id: 3, eventType: 'EVENT', actionEvent: { eachOptionList: [{ index: 0, resultList: [{ resultIndex: 0, nextEventID: 3 }, { resultIndex: 1, nextEventID: 1 }] }] } },
  ]
  const graph = walkEventGraph(new Map(nodes.map(n => [n.id, n])), new Set([1]))
  expect([...graph.reachable]).toEqual([1, 2, 3])
  expect(graph.edges).toEqual([[1, 2], [2, 3], [3, 3], [3, 1]])
})
it('keeps the actual option/result indices and selects a single matching narrative', () => {
  const node: SourceEvent = { id: 9, eventType: 'EVENT', actionEvent: { eachOptionList: [{ index: 4, resultList: [{ resultIndex: 1 }, { resultIndex: 0 }] }] } }
  expect(sourceResults(node).map(row => [row.optionIndex, row.result.resultIndex])).toEqual([[4, 1], [4, 0]])
  expect(sourceResultText(['success', 'retry'], 1)).toBe('retry')
  expect(sourceResultText(['shared'], 1)).toBe('shared')
  expect(sourceResultText(['one', 'two'], 4)).toBeNull()
})
it('rejects a missing child rather than silently dropping the edge', () => {
  const node: SourceEvent = { id: 1, eventType: 'EVENT', actionEvent: { eachOptionList: [{ index: 0, resultList: [{ resultIndex: 0, nextEventID: 2 }] }] } }
  expect(() => walkEventGraph(new Map([[1, node]]), new Set([1]))).toThrow('Missing source event 2')
})

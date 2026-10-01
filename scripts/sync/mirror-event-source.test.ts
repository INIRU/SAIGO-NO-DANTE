import { expect, it } from 'vitest'
import { eventText, identicalEventCopies, sequenceEventIds, sinnerCharacterId, sourceResultText, sourceResults, walkEventGraph, type SourceEvent, graphRowDiff } from './mirror-event-source'

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
it('REQ-DATA-SYNC-015 takes the events a fixed floor or a curse fills in from the theme map sequence', () => {
  // Theme 1118 (2026-09-24 data): its three events exist only in FILL_EMPTY_EVENT, so they were never synced.
  const sequence = [
    { type: 'CREATE_FIXED_FLOOR', numberList: [3, 3, 1], nodeList: [{ encounterType: 3, encounterId: 0 }] },
    { type: 'FILL_EMPTY_EVENT', numberList: [971057, 971058, 971059] },
    { type: 'FILL_EMPTY_BOSS', numberList: [2068131] },
    { type: 'OVERRIDE_RANDOM_EVENT_BY_CURSE_EVENT', numberList: [971085, 971086] },
    { type: 'CREATE_EMPTY_MD4_FLOOR', numberList: [4, 3, 1] },
  ]
  expect(sequenceEventIds(sequence)).toEqual([971057, 971058, 971059, 971085, 971086])
  expect(sequenceEventIds(undefined)).toEqual([])
})
it('REQ-DATA-SYNC-016 names every sinner a judgment correction can name, and refuses an unknown one', () => {
  // 971057 (2026-09-24) added "SpecificUnit_Donquixote"; the label fell back to the raw key "Donquixote +5".
  expect(sinnerCharacterId('Donquixote')).toBe(3)
  expect(['Yisang', 'Faust', 'Donquixote', 'Ryosyu', 'Meursault', 'Honglu', 'Heathcliff', 'Ishmael', 'Rodion', 'Sinclair', 'Outis', 'Gregor']
    .map(sinnerCharacterId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  expect(() => sinnerCharacterId('Dante')).toThrow('Unknown sinner key Dante')
})
it('REQ-DATA-SYNC-017 marks exact copies of one event, and nothing that differs in any field or text', () => {
  // 가시춘 학생의 수업 복습 (2026-09-24): 971070–971072 differ only in their ID, in the source graph and in all three languages.
  const node = (id: number, gift = 9822, next = -1): SourceEvent => ({ id, eventType: 'EVENT',
    actionEvent: { eachOptionList: [{ index: 0, resultList: [{ resultIndex: 0, nextEventID: next, eventResultDataList: [{ resultForm: { itemReward: { type: 'EGO_GIFT', rewardId: gift } } }] }] }] } })
  const text = (id: number) => id === 971074 ? 'another story' : '가시춘 학생의 수업 복습'
  const copies = identicalEventCopies([node(971071), node(971070), node(971072), node(971073, 9823), node(971074)], text)
  expect(copies).toEqual(new Map([[971071, 971070], [971072, 971070]]))
  // A different continuation is a different event.
  expect(identicalEventCopies([node(1, 9822, 5), node(2, 9822, 6)], () => 'same')).toEqual(new Map())
})

it('stores the sinner the player picked as {{sinner}} (97111202, 90101503)', () => {
  expect(sourceResultText(['{0} 수감자가 앞서 걸어가면'], 0)).toBe('{{sinner}} 수감자가 앞서 걸어가면')
  expect(eventText('[{0}] 수감자가 케이블을')).toBe('[{{sinner}}] 수감자가 케이블을')
  expect(eventText(null)).toBeNull()
})

it('REQ-DATA-SYNC-047 counts new, changed and DB-only rows by the columns the plan produces', () => {
  const key = (row: Record<string, unknown>) => String(row.id)
  const plan = [{ id: 1, name: 'a', judgment: { b: 2, a: 1 } }, { id: 2, name: 'b', judgment: null }, { id: 3, name: 'c', judgment: null }]
  // The DB carries columns the plan does not write (created_at) and stores JSON keys in another order: neither is a change.
  const same = [{ id: 1, name: 'a', judgment: { a: 1, b: 2 }, created_at: 'x' }, { id: 2, name: 'b', judgment: null, created_at: 'y' }, { id: 3, name: 'c', judgment: null, created_at: 'z' }]
  expect(graphRowDiff(plan, same, key)).toEqual({ new: 0, changed: 0, removed: 0 })
  const drifted = [{ id: 1, name: 'A', judgment: { a: 1, b: 2 } }, { id: 2, name: 'b', judgment: null }, { id: 9, name: 'gone', judgment: null }]
  expect(graphRowDiff(plan, drifted, key)).toEqual({ new: 1, changed: 1, removed: 1 })
  expect(graphRowDiff([], [], key)).toEqual({ new: 0, changed: 0, removed: 0 })
})

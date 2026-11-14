import { describe, expect, it } from 'vitest'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import type { FloorDifficulty, FloorEntry, GiftData, PlannerAction, ThemeData } from '@/lib/planner/types'
import { getAvailableThemes, getFinalGiftVariantIds, themeExclusiveGiftIds } from '@/lib/planner/fusion'
import { isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { finalKeyForFloorPick } from '@/features/planner/lib/final-gifts'
import {
  LADDER_SEGMENTS,
  availableThemesByFloor,
  floorDifficultyChange,
  floorGiftToggleActions,
  floorRepairAction,
  getDifficultyTone,
  getMemoPreview,
  getThemeGiftCount,
  ladderSegments,
  normalizeFloorDifficulty,
  pickerThemesFor,
  reachableGiftsFor,
} from '@/features/planner/lib/floor-view'

// The functions below are the originals from FloorTab.tsx, kept verbatim to compare the extracted ones against.
function oldDifficultyTone(difficulty: FloorDifficulty) {
  if (difficulty === 'extreme') return '#d0675c'
  if (difficulty === 'overlap') return '#e8b030'
  if (difficulty === 'hard') return '#c8900a'
  return '#9c8b73'
}

function oldThemeGiftCount(theme: ThemeData | null) {
  if (!theme) return 0
  return new Set([...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? []), ...(theme.fixed_reward_gift_ids ?? [])]).size
}

function oldMemoPreview(memo: string) {
  return memo
    .replace(/\[(?:s|p|e|k|i|g):([^\]]+)\]/g, '$1')
    .replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function oldNormalize(entryDifficulty: unknown, floor: number): FloorDifficulty {
  if (isFloorDifficulty(entryDifficulty) && isAllowedFloorDifficulty(entryDifficulty, floor)) return entryDifficulty
  if (floor <= 5) return 'hard'
  if (floor <= 10) return 'overlap'
  return 'extreme'
}

function theme(id: number, floorInfo: ThemeData['floor_info'], extra: Partial<ThemeData> = {}): ThemeData {
  return { id: String(id), name: `t${id}`, ego_gift_ids: null, specific_ego_gift_ids: null, image_url: null, difficulty: null, floor_info: floorInfo, ...extra }
}

const themes: ThemeData[] = [
  theme(1, { 노말: [1, 2], 하드: [1, 2, 3] }, { ego_gift_ids: [10, 11], specific_ego_gift_ids: [12] }),
  theme(2, { 하드: [4, 5], 평행중첩: [1, 2, 3] }, { ego_gift_ids: [11, 13], fixed_reward_gift_ids: [14, 10] }),
  theme(3, { 평행중첩: '전체', 익스트림: [1, 2] }, { specific_ego_gift_ids: [20, 21], fixed_reward_gift_ids: [22] }),
  theme(4, null),
  theme(5, { 익스트림: [3, 4, 5] }, { ego_gift_ids: [30] }),
]

function entry(floor: number, extra: Partial<FloorEntry> = {}): FloorEntry {
  return { floor, difficulty: 'hard', theme_id: null, gift_ids: [], memo: '', ...extra }
}

function makePlan(extra: Record<number, Partial<FloorEntry>> = {}): FloorEntry[] {
  return Array.from({ length: 15 }, (_, i) => {
    const floor = i + 1
    return entry(floor, { difficulty: floor <= 5 ? 'hard' : floor <= 10 ? 'overlap' : 'extreme', ...extra[floor] })
  })
}

const DIFFICULTIES: FloorDifficulty[] = ['normal', 'hard', 'overlap', 'extreme']

describe('floor view helpers', () => {
  it('normalizeFloorDifficulty matches the original for every difficulty, floor and junk value', () => {
    for (const value of [...DIFFICULTIES, 'weird', undefined, null, 3, '']) {
      for (let floor = 0; floor <= 16; floor++) {
        expect(normalizeFloorDifficulty(value, floor)).toBe(oldNormalize(value, floor))
      }
    }
  })

  it('getDifficultyTone matches the original', () => {
    for (const difficulty of DIFFICULTIES) expect(getDifficultyTone(difficulty)).toBe(oldDifficultyTone(difficulty))
  })

  it('getThemeGiftCount matches the original, counting each gift once', () => {
    for (const t of [...themes, null]) expect(getThemeGiftCount(t)).toBe(oldThemeGiftCount(t))
    expect(getThemeGiftCount(themes[1])).toBe(4)
  })

  it('getMemoPreview matches the original', () => {
    const memos = ['', '  ', '# 제목\n- **굵게** `코드` > 인용', '[s:이상] 그리고 [g:기프트] [p:패시브]', '{{skill|extra}} 뒤 {{plain}}', '[링크](https://a.b/c) 끝', 'a\n\n\nb\t c ~ d', '[k:키워드][e:EGO][i:인격]']
    for (const memo of memos) expect(getMemoPreview(memo)).toBe(oldMemoPreview(memo))
  })

  it('ladderSegments matches the original grouping', () => {
    const oldSegments = (plan: FloorEntry[]) => LADDER_SEGMENTS
      .map(segment => ({ ...segment, entries: plan.filter(e => e.floor >= segment.start && e.floor <= segment.end) }))
      .filter(segment => segment.entries.length > 0)
    for (const plan of [makePlan(), makePlan().slice(0, 7), makePlan().slice(5), [], makePlan().filter(e => e.floor % 2 === 0)]) {
      expect(ladderSegments(plan)).toEqual(oldSegments(plan))
    }
  })
})

describe('floor theme availability', () => {
  const plans = [
    makePlan(),
    makePlan({ 1: { theme_id: '1' }, 2: { theme_id: '2' }, 6: { theme_id: '2' }, 7: { theme_id: '3' }, 12: { theme_id: '3' } }),
    makePlan({ 1: { difficulty: 'normal', theme_id: '1' }, 4: { difficulty: 'normal' }, 8: { difficulty: 'hard' }, 12: { difficulty: 'overlap' } }),
    makePlan({ 3: { difficulty: 'bogus' as FloorDifficulty }, 9: { theme_id: '999' }, 13: { theme_id: '5' }, 14: { theme_id: '4' } }),
  ]

  it('availableThemesByFloor matches the original loop', () => {
    for (const plan of plans) {
      const expected = new Map<number, ThemeData[]>()
      for (const e of plan) {
        const difficulty = oldNormalize(e.difficulty, e.floor)
        expected.set(e.floor, getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], e.floor))
      }
      expect(availableThemesByFloor(plan, themes)).toEqual(expected)
    }
  })

  it('floorRepairAction matches the original effect body', () => {
    const old = (plan: FloorEntry[]): PlannerAction | null => {
      const invalidEntry = plan.find(e => {
        const difficulty = oldNormalize(e.difficulty, e.floor)
        if (e.difficulty !== difficulty) return true
        if (!e.theme_id) return false
        const available = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], e.floor)
        return !available.some(t => String(t.id) === e.theme_id)
      })
      if (!invalidEntry) return null
      const difficulty = oldNormalize(invalidEntry.difficulty, invalidEntry.floor)
      const available = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], invalidEntry.floor)
      const hasInvalidTheme = Boolean(invalidEntry.theme_id && !available.some(t => String(t.id) === invalidEntry.theme_id))
      return { type: 'SET_FLOOR_DIFFICULTY', floor: invalidEntry.floor, difficulty, clearSelection: hasInvalidTheme }
    }
    for (const plan of plans) expect(floorRepairAction(plan, themes)).toEqual(old(plan))
    expect(floorRepairAction([], themes)).toBeNull()
    expect(floorRepairAction(makePlan(), themes)).toBeNull()
  })

  it('pickerThemesFor matches the original filter', () => {
    const plan = makePlan({ 1: { theme_id: '1' }, 2: { theme_id: '2' }, 3: { theme_id: '1' } })
    for (const active of [undefined, ...plan]) {
      const available = active ? availableThemesByFloor(plan, themes).get(active.floor) ?? [] : []
      const old = (() => {
        if (!active) return []
        const used = new Set(plan.filter(e => e.floor !== active.floor && e.theme_id).map(e => e.theme_id!))
        return available.filter(t => !used.has(String(t.id)) || String(t.id) === active.theme_id)
      })()
      expect(pickerThemesFor(active, plan, available)).toEqual(old)
    }
  })

  it('floorDifficultyChange matches the original setDifficulty body', () => {
    for (const e of [entry(1), entry(1, { theme_id: '1' }), entry(2, { theme_id: '2' }), entry(4, { theme_id: '2' }), entry(5, { theme_id: '999' })]) {
      for (const difficulty of ['normal', 'hard'] as const) {
        const nextThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], e.floor)
        const valid = !e.theme_id || nextThemes.some(t => String(t.id) === e.theme_id)
        expect(floorDifficultyChange(e, difficulty, themes)).toEqual({
          action: { type: 'SET_FLOOR_DIFFICULTY', floor: e.floor, difficulty, clearSelection: !valid },
          selectedStillValid: valid,
        })
      }
    }
  })

  it('reachableGiftsFor matches the original memo body', () => {
    const gifts = [10, 11, 12, 13, 14, 20, 21, 22, 30, 99].map(game_id => ({ game_id }) as GiftData)
    for (const selected of [null, ...themes]) {
      const ownExclusive = new Set(selected ? themeExclusiveGiftIds(selected) : [])
      const otherExclusive = new Set(themes.flatMap(t => themeExclusiveGiftIds(t)).filter(id => !ownExclusive.has(id)))
      expect(reachableGiftsFor(gifts, themes, selected)).toEqual(gifts.filter(g => !otherExclusive.has(g.game_id)))
    }
  })
})

describe('floorGiftToggleActions', () => {
  // The original toggleGiftId, with dispatch collecting into a list.
  function old(floor: number, giftGameId: string, currentIds: string[], floorPlan: FloorEntry[], derivedFinal: Parameters<typeof finalKeyForFloorPick>[1]) {
    const out: PlannerAction[] = []
    const dispatch = (action: PlannerAction) => { out.push(action) }
    if (currentIds.includes(giftGameId)) {
      dispatch({ type: 'SET_FLOOR_GIFTS', floor, giftIds: currentIds.filter(id => id !== giftGameId) })
      const selectedOnAnotherFloor = floorPlan.some(e => e.floor !== floor && e.gift_ids.includes(giftGameId))
      if (!selectedOnAnotherFloor) {
        const gid = parseInt(giftGameId, 10)
        if (!Number.isNaN(gid)) {
          for (const giftId of getFinalGiftVariantIds(gid)) dispatch({ type: 'REMOVE_GIFT', giftId })
        }
      }
    } else {
      const gid = parseInt(giftGameId, 10)
      if (Number.isNaN(gid)) return out
      dispatch({ type: 'SET_FLOOR_GIFTS', floor, giftIds: [...currentIds, giftGameId] })
      const finalKey = finalKeyForFloorPick(gid, derivedFinal)
      if (finalKey) dispatch({ type: 'ADD_GIFT', giftId: finalKey })
    }
    return out
  }

  const plan = makePlan({ 1: { gift_ids: ['100', '200'] }, 2: { gift_ids: ['200', '300'] }, 3: { gift_ids: [] } })
  const finals = [
    { gifts: [], consumed: new Set<number>() },
    { gifts: [{ id: 100 }] as never[], consumed: new Set<number>() },
    { gifts: [], consumed: new Set<number>([300]) },
  ]

  it('matches the original for ticking, unticking, shared gifts and junk ids', () => {
    for (const final of finals) {
      for (const floor of [1, 2, 3]) {
        const currentIds = plan.find(e => e.floor === floor)!.gift_ids
        for (const id of ['100', '200', '300', '400', 'abc', '']) {
          expect(floorGiftToggleActions(floor, id, currentIds, plan, final)).toEqual(old(floor, id, currentIds, plan, final))
        }
      }
    }
  })

  it('unticking a gift only this floor holds drops its final keys; ticking one adds final_<id>', () => {
    const [set, ...removes] = floorGiftToggleActions(1, '100', ['100', '200'], plan, finals[0])
    expect(set).toEqual({ type: 'SET_FLOOR_GIFTS', floor: 1, giftIds: ['200'] })
    expect(removes.every(a => a.type === 'REMOVE_GIFT')).toBe(true)
    expect(floorGiftToggleActions(3, '400', [], plan, finals[0])).toEqual([
      { type: 'SET_FLOOR_GIFTS', floor: 3, giftIds: ['400'] },
      { type: 'ADD_GIFT', giftId: 'final_400' },
    ])
    expect(floorGiftToggleActions(3, 'abc', [], plan, finals[0])).toEqual([])
  })
})

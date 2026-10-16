import { describe, expect, it } from 'vitest'
import { getAvailableThemes } from '@/lib/planner/fusion'

// 기어오는 심연(1014)처럼 노말과 하드에서 나오는 층이 다른 팩.
const crawlingAbyss = { id: 1014, floor_info: { 노말: [4, 5], 하드: [3, 4] } }
const hardOnly = { id: 2, floor_info: { 하드: [5], 평행중첩: '전체' } }
const extreme = { id: 3, floor_info: { 익스트림: '전체' } }
const ids = (difficulty: string, floor: number) => getAvailableThemes([crawlingAbyss, hardOnly, extreme], difficulty, floor).map(theme => theme.id)

describe('REQ-PLANNER-027 theme packs follow the floor difficulty', () => {
  it('REQ-PLANNER-027 a hard floor offers only the packs of the hard floor list', () => {
    expect(ids('하드', 5)).toEqual([2])
    expect(ids('하드', 3)).toEqual([1014])
    expect(ids('하드', 4)).toEqual([1014])
  })

  it('REQ-PLANNER-027 a normal floor offers only the packs of the normal floor list', () => {
    expect(ids('노말', 5)).toEqual([1014])
    expect(ids('노말', 3)).toEqual([])
  })

  it('REQ-PLANNER-027 floors 1-5 asked with an overlap or extreme key are hard floors', () => {
    expect(ids('익스트림', 5)).toEqual([2])
    expect(ids('평행중첩', 3)).toEqual([1014])
    expect(ids('평행중첩', 7)).toEqual([2])
    expect(ids('익스트림', 12)).toEqual([3])
  })
})

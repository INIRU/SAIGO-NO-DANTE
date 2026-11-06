import { expect, it } from 'vitest'
import { confirmsExploration, explorationFloor, explorationThemeIds, explorationThemeMatch, explorationThemeReads, themeSelectionHeaderFloor } from '@/features/assist/lib/exploration-match'

const themes = [
  { id: '1003', texts: ['카지노 푸어'] },
  { id: 'line-3', texts: ['4호선 제3구간'] },
  { id: 'line-4', texts: ['4호선 제4구간'] },
  { id: '1102', texts: ['우.미.다'] },
  { id: '1505', texts: ['우.미.다 게.판'] },
  { id: 'twin-a', texts: ['같은 이름'] },
  { id: 'twin-b', texts: ['같은 이름'] },
  { id: '1003-ja', texts: ['カジノプアー'] },
  { id: 'line-2', texts: ['Line 2'] },
  { id: 'line-2b', texts: ['Line 3'] },
]
const word = (text: string, left: number, width = 20, height = 20) => ({ text, left, width, top: 0, height, confidence: 90 })

it('reads the floor only from the exploration banner, tolerating common Hangul misreads', () => {
  expect(explorationFloor('1층 탐사 중')).toBe(1)
  expect(explorationFloor('4증람사중')).toBe(4)
  expect(explorationFloor('12층 탐사 중')).toBe(12)
  expect(explorationFloor('Exploring, Floor 3')).toBe(3)
  expect(explorationFloor('1階層 探査中')).toBe(1)
  expect(explorationFloor('1층 테마팩 선택')).toBeNull()
  expect(explorationFloor('1F - Hardest Part 1')).toBeNull()
  expect(explorationFloor('4S EAS')).toBeNull()
  expect(explorationFloor('탐사 중')).toBeNull()
  expect(explorationFloor('16층 탐사 중')).toBeNull()
})

it('matches the exact pack name in the first word group and ignores distant marks', () => {
  expect(explorationThemeIds([word('카지노', 0, 60), word('푸어', 70, 40), word('7', 400)], themes)).toEqual(['1003'])
  expect(explorationThemeIds([word(',', 0, 5), word('카지노', 10, 60), word('푸어', 80, 40)], themes)).toEqual(['1003'])
  expect(explorationThemeIds([word('우.미.다', 0, 60)], themes)).toEqual(['1102'])
  expect(explorationThemeIds([word('우.미.다', 0, 60), word('게.판', 70, 40)], themes)).toEqual(['1505'])
})

it('accepts a one-glyph misread only when a single long pack name is clearly nearest', () => {
  expect(explorationThemeIds([word('가지노', 0, 60), word('푸어', 70, 40)], themes)).toEqual(['1003'])
  expect(explorationThemeIds([word('4호선', 0, 60), word('제5구간', 70, 60)], themes)).toEqual([])
  expect(explorationThemeIds([word('우.머.다', 0, 60)], themes)).toEqual([])
  expect(explorationThemeIds([word('가지고', 0, 60), word('푸머', 70, 40)], themes)).toEqual([])
})

it('abstains on misreads and adjacent noise instead of guessing the nearest pack', () => {
  expect(explorationThemeIds([word('우미.다르', 0, 80)], themes)).toEqual([])
  expect(explorationThemeIds([], themes)).toEqual([])
  expect(explorationThemeIds([word('같은', 0, 40), word('이름', 50, 40)], themes)).toEqual(['twin-a', 'twin-b'])
})

it('requires independent theme reads to agree when both are readable', () => {
  const casino = [word('카지노', 0, 60), word('푸어', 70, 40)]
  expect(explorationThemeMatch([casino, [word('Bat', 0)]], themes)).toEqual(['1003'])
  expect(explorationThemeMatch([casino, [word('우.미.다', 0, 60)]], themes)).toEqual([])
})

it('confirms a banner only after two separate matching captures within the window', () => {
  const first = { floor: 2, themeIds: ['1101'], observedAt: 10_000 }
  expect(confirmsExploration(null, first)).toBe(false)
  expect(confirmsExploration(first, { ...first, observedAt: 12_000 })).toBe(true)
  expect(confirmsExploration(first, { ...first, observedAt: 10_400 })).toBe(false)
  expect(confirmsExploration(first, { ...first, observedAt: 150_000 })).toBe(true)
  expect(confirmsExploration(first, { ...first, observedAt: 200_000 })).toBe(false)
  expect(confirmsExploration(first, { ...first, floor: 3, observedAt: 12_000 })).toBe(false)
  expect(confirmsExploration(first, { ...first, themeIds: ['1102'], observedAt: 12_000 })).toBe(false)
})

it('confirms at once from an exact, unambiguous pack name, and ignores kana voicing marks and the long-vowel mark', () => {
  // Japanese OCR read カジノプアー as カジノブア on the banner line (2026-09-28 gameplay video).
  expect(explorationThemeIds([word('カジノブア', 0, 80)], themes)).toEqual(['1003-ja'])
  expect(explorationThemeReads([[word('카지노', 0, 60), word('푸어', 70, 40)]], themes)).toEqual({ ids: ['1003'], certain: true })
  expect(explorationThemeReads([[word('カジノブア', 0, 80)]], themes)).toEqual({ ids: ['1003-ja'], certain: true })
  // One glyph off, a digit away from another pack, or two agreeing packs: two captures are still needed.
  expect(explorationThemeReads([[word('가지노', 0, 60), word('푸어', 70, 40)]], themes).certain).toBe(false)
  expect(explorationThemeReads([[word('Line', 0, 40), word('2', 45, 10)]], themes)).toEqual({ ids: ['line-2'], certain: false })
  expect(explorationThemeReads([[word('같은', 0, 40), word('이름', 50, 40)]], themes).certain).toBe(false)
  const single = { floor: 1, themeIds: ['1003'], observedAt: 10_000 }
  expect(confirmsExploration(null, { ...single, certain: true })).toBe(true)
  expect(confirmsExploration(null, single)).toBe(false)
})

it('reads the selection header floor per line, never joining digits from a neighbouring line', () => {
  // Shape of a real GPU OCR read: a timer line "9:02" directly above the header used to parse as floor 22.
  expect(themeSelectionHeaderFloor('4F\n9:02\n2층 테마팩 선택\n5F')).toBe(2)
  expect(themeSelectionHeaderFloor('2 층 테마팩 선택')).toBe(2)
  expect(themeSelectionHeaderFloor('|12층 테마팩선택')).toBe(12)
  expect(themeSelectionHeaderFloor('9:022층 테마팩 선택')).toBeNull()
  expect(themeSelectionHeaderFloor('2층 래미멕 선택')).toBeNull()
  expect(themeSelectionHeaderFloor('22층 테마팩 선택')).toBeNull()
  expect(themeSelectionHeaderFloor('')).toBeNull()
})

import { expect, it } from 'vitest'
import { readSkillExchange, skillExchangeMoves } from '@/lib/vision/skill-exchange'

// Full-frame OCR (balanced mode) of the 2026-09-21 video: f15900, f157560, f245700 and the confirm step f54900.
const ishmael = "스킬 보유현황\n키워드\n이스마엘 스킬 교체\n1422\n'근고침\nSKILL1x3\nSKILL2x2\nSKILL3X1\n적당한 비용을 치룬다.\n큰 값을 치룬다.\n45\nSKILL 1\nSKILL2\n내주위에서라!\nx1\n× 취소\n확인\n나가기"
const yiSang = "후\n스킬보유현황\n키워드\n이상 스킬 교체\n1178\n근고침\nSKILL1x2\nSKILL2x3\nSKILL3X1\nD\n적당한 비용을 치룬다.\nSKILL1\nSKILL 2\n후벼파기\nx1\n× 취소\n확인"
const heathcliff = "후\n스킬보유현황\n히스클리프 스킬 교체\n\n2937\nSKILL1x2\nSKILL 2x2\nSKILL3x2\n2\n사냥감 추적\n작살박이\nx1"
const confirm = "Q\n스킬보유현황\n키워드\n이스마엘 스킬 교체\n1065825\n근고침\nSKILL1x2\nSKILL2x2\nSKILL3x2\nSKILL1\n코스트 240을 소모하여 교체하시겠습니까?\n× 취소\n‘ 구매"

it('reads the sinner and current skill counts from the replacement window', () => {
  expect(readSkillExchange(ishmael)).toEqual({ sinner: 8, current: [3, 2, 1] })
  expect(readSkillExchange(yiSang)).toEqual({ sinner: 1, current: [2, 3, 1] })
  expect(readSkillExchange(heathcliff)).toEqual({ sinner: 7, current: [2, 2, 2] })
  expect(readSkillExchange(confirm)).toEqual({ sinner: 8, current: [2, 2, 2] })
  // A misread count keeps the sinner; English titles need the counts; other shop screens never match.
  expect(readSkillExchange('이상 스킬 교체\nSKILL1x3\nSKILL2x9')).toEqual({ sinner: 1, current: null })
  expect(readSkillExchange('Ishmael Skill Replacement\nSKILL1x3\nSKILL2x2\nSKILL3x1')).toEqual({ sinner: 8, current: [3, 2, 1] })
  expect(readSkillExchange('Ishmael Skill Replacement')).toBeNull()
  expect(readSkillExchange('E.G.O 기프트 판매\n이상\n스킬 1')).toBeNull()
})

it('plans the fewest replacements from the current counts to the plan', () => {
  expect(skillExchangeMoves([3, 2, 1], [1, 0, 5])).toEqual([{ from: 1, to: 3, count: 2 }, { from: 2, to: 3, count: 2 }])
  expect(skillExchangeMoves([3, 2, 1], [0, 0, 6])).toEqual([{ from: 1, to: 3, count: 3 }, { from: 2, to: 3, count: 2 }])
  expect(skillExchangeMoves([3, 2, 1], [1, 4, 1])).toEqual([{ from: 1, to: 2, count: 2 }])
  expect(skillExchangeMoves([2, 2, 2], [2, 2, 2])).toEqual([])
  // Replacements only move copies up: more Skill 1 or fewer Skill 3 than now cannot be reached.
  expect(skillExchangeMoves([2, 2, 2], [3, 2, 1])).toBeNull()
})

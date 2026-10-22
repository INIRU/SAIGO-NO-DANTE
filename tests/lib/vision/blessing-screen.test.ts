import { expect, it } from 'vitest'
import { BLESSING_KEEP_MS, onBlessingScreen, showsBlessingScreen } from '@/lib/vision/blessing-screen'

it('REQ-ASSIST-081 reads the starlight screen from its title and entry button in any card colour', () => {
  // OCR of the 2026-10 blue screen (spacing and line breaks as read).
  expect(showsBlessingScreen('시지프 별의 가호\n보유 1741 사용 가능 120\n시작의 별 +\n가호 전체 선택 전체 강화\n입장')).toBe(true)
  expect(showsBlessingScreen('시지프 별 의가호 ... 입 장')).toBe(true)
  // The title alone (a gift or event text naming it) or the button alone (another screen's entry) is not enough.
  expect(showsBlessingScreen('별의 가호 효과 발동')).toBe(false)
  expect(showsBlessingScreen('거울 던전 입장')).toBe(false)
})

it('REQ-ASSIST-081 keeps the screen for a while after the read', () => {
  expect(onBlessingScreen(1000, 1000 + BLESSING_KEEP_MS - 1)).toBe(true)
  expect(onBlessingScreen(1000, 1000 + BLESSING_KEEP_MS)).toBe(false)
  expect(onBlessingScreen(0, 10)).toBe(false)
})

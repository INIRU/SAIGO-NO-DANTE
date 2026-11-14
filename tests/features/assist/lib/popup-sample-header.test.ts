import { describe, expect, it } from 'vitest'
import { popupHeaderEvidence } from '@/features/assist/lib/popup-evidence'

// Header reads of the 2026-09-25/26 recognition samples (PaddleOCR, as the app reads them).
describe('popup samples need the acquisition header', () => {
  it('accepts acquisition headers, also with the shop banner read beside them', () => {
    for (const header of ['E.G.O 기프트를 획득했습니다.', 'E.G.O 기프트를 획득했습니다', '특별한 상점 등장 확률\nE.G.O 기프트를 획득했습니다',
      '별한 상점등장확\n35%\nE.G.O 기프트를 획득했습니다.']) expect(popupHeaderEvidence(header)).toBe(true)
  })

  it('rejects the look-alike dialogs and panels that filled most uploaded samples', () => {
    for (const header of ['E.G.O 기프트 정보', '461\nE.G.O 기프트 구매\n461→24', '1298\n다음 층에서\n330\n절등\nE.G.O 기프트 구매\n129810',
      'IMNMMI', '를 압성', '한석 조합식', '', 'MAX']) expect(popupHeaderEvidence(header)).toBe(false)
  })
})

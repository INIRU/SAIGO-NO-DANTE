import { expect, it } from 'vitest'
import { costBeforeSale, EMPTY_SALE_STATE, isSellWindow, readSaleStep, saleOutcome, sellCost, sellDialog, sellGiftId, soldOnShopScreen } from '@/features/assist/lib/sell-evidence'

// OCR text as read from the 2026-09-21 video frames (scripts/vision/bench_ocr_modes.ts).
it('reads the gift and price from the dialog in any line order and with mixed brackets', () => {
  expect(sellDialog('+ | 129229 | E.G.O 기프트 판매 | 424 | [어두운 잔영]을(를] 코스트100에 | 판매하시겠습니까? | × 취소 | 확인'.replaceAll(' | ', '\n')))
    .toEqual({ name: '어두운잔영', price: 100 })
  expect(sellDialog('[칸타빌레]을(를)코스트156에\n판매하시겠습니까?')).toEqual({ name: '칸타빌레', price: 156 })
  // Quality-mode tiles split the dialog line and interleave other lines.
  expect(sellDialog('두운 잔영]을(를)코스트 50에\nX\n50에\n판매하시겠습니까?')).toEqual({ name: '두운잔영', price: 50 })
  expect(sellDialog('[빛나는 잔영]을(를)코스\n트\n150에\n3등급 E.G.O 기프트로 취\n판매하시겠습니까?')).toEqual({ name: '빛나는잔영', price: 150 })
  expect(sellDialog('상점에서 나가시겠습니까?')).toBeNull()
  expect(sellDialog('선택한 E.G.O 기프트를 조합하시겠습니까?')).toBeNull()
  expect(isSellWindow('E.G.O 기프트 판매\n등급순')).toBe(true)
  expect(isSellWindow('E.G.O 기프트 합성')).toBe(false)
})

it('reads the top-right cost groups and splits a merged "before after" by the price', () => {
  const word = (text: string, left: number, top = 125) => ({ text, left, top, width: 180, height: 57 })
  expect(sellCost([word('129229', 1470), word('+', 1820, 42), word('300', 400)], 1920, 1080)).toEqual(['129229'])
  expect(sellCost([word('683-783', 1470)], 1920, 1080)).toEqual(['683', '783'])
  expect(costBeforeSale(['129229'], 100)).toBe(129)
  expect(costBeforeSale(['56356'], 300)).toBe(56)
  expect(costBeforeSale(['79229'], 150)).toBe(79)
  expect(costBeforeSale(['683', '783'], 100)).toBe(683)
  expect(costBeforeSale(['683'], 100)).toBe(683)
})

it('matches the dialog name to one gift, also when its first letter was clipped', () => {
  const gifts = [{ id: '1', texts: ['빛나는 잔영'] }, { id: '2', texts: ['어두운 잔영'] }, { id: '3', texts: ['아스라한 잔영'] }]
  expect(sellGiftId('빛나는잔영', gifts)).toBe('1')
  expect(sellGiftId('두운잔영', gifts)).toBe('2')
  expect(sellGiftId('잔영', gifts)).toBeNull()
  expect(sellGiftId('없는 기프트', gifts)).toBeNull()
})

it('counts a sale only when the cost afterwards starts with before + price', () => {
  const pending = { giftId: '1', name: '빛나는 잔영', price: 300, at: 1000, costBefore: 233 }
  expect(saleOutcome(pending, ['533683'], 1500)).toBe('sold')
  expect(saleOutcome(pending, ['533'], 1500)).toBe('sold')
  expect(saleOutcome(pending, ['233533'], 1500)).toBe('cancelled')
  expect(saleOutcome(pending, [], 1500)).toBeNull()
  expect(saleOutcome(pending, ['999'], 1500)).toBeNull()
  expect(saleOutcome(pending, ['533'], 7000)).toBe('expired')
  expect(saleOutcome({ ...pending, price: 300, costBefore: 56 }, ['356506'], 1500)).toBe('sold')
  expect(saleOutcome({ ...pending, price: 300, costBefore: 56 }, ['56356'], 1500)).toBe('cancelled')
  // Sell window closed at once: the shop screen shows the new total (replay 961.85 s: shop cost 279 after 229 + 50).
  expect(soldOnShopScreen({ ...pending, price: 50, costBefore: 229 }, '특별한 상점\n키워드\n새로고침\n279\n74%')).toBe(true)
  expect(soldOnShopScreen({ ...pending, price: 50, costBefore: 229 }, '특별한 상점\n229\n새로고침')).toBe(false)
})

it('replays recorded read sequences through one sale decision', () => {
  const gifts = [{ id: '9172', texts: ['칸타빌레'] }, { id: '9993', texts: ['빛나는 잔영'] }, { id: '9991', texts: ['어두운 잔영'] }]
  const giftId = (name: string) => sellGiftId(name, gifts)
  const window = 'E.G.O 기프트 판매\n등급순'
  const dialog = (name: string, price: number) => `${window}\n[${name}]을(를)코스트 ${price}에\n판매하시겠습니까?`
  const run = (reads: [number, string, string[]][]) => {
    let state = EMPTY_SALE_STATE
    const sold: string[] = []
    for (const [at, text, cost] of reads) {
      const step = readSaleStep(state, { at, text, cost, giftId })
      state = step.state
      sold.push(...step.sold.map(sale => `${sale.giftId}@${sale.at}`))
    }
    return sold
  }
  // 3572 s: the dialog is read twice while up (cost still "167 323"), then the window shows 323: one sale.
  expect(run([[1000, window, ['167', '323']], [1500, dialog('칸타빌레', 156), ['167323']], [2000, dialog('칸타빌레', 156), ['167323']],
    [2500, window, ['323']]])).toEqual(['9172@1500'])
  // Cancel keeps the cost.
  expect(run([[1000, window, ['376676']], [1500, dialog('빛나는 잔영', 150), ['376526']], [2500, window, ['376526']]])).toEqual([])
  // A dialog read while closing already shows the sold total; the next read of it is not a second sale.
  expect(run([[1000, window, ['533683']], [1500, dialog('빛나는 잔영', 150), ['683']], [1900, dialog('빛나는 잔영', 150), ['683']],
    [2400, window, ['683']]])).toEqual(['9993@1500'])
  // Same gift, same price, 1.75 s apart with a window read between: two sales, the second settled by its successor's cost.
  expect(run([[1000, window, ['356506']], [1400, dialog('빛나는 잔영', 150), ['356506']], [2200, window, ['506656']],
    [3150, dialog('빛나는 잔영', 150), ['506656']], [3900, window, ['656']]])).toEqual(['9993@1400', '9993@3150'])
  // The next dialog shows the new cost before any window read settled the first sale.
  expect(run([[1000, window, ['129229']], [1500, dialog('어두운 잔영', 100), ['129229']], [3500, dialog('어두운 잔영', 50), ['229279']]]))
    .toEqual(['9991@1500'])
  // Leaving to the shop right after the last sale: its screen shows the new total.
  expect(run([[1000, window, ['229279']], [1500, dialog('어두운 잔영', 50), ['229279']], [2500, '특별한 상점\n279\n새로고침', []]]))
    .toEqual(['9991@1500'])
  // A first dialog frame without any cost is retried on the next read of the same dialog.
  expect(run([[1500, dialog('칸타빌레', 156), []], [2000, dialog('칸타빌레', 156), ['167323']], [2500, window, ['323']]])).toEqual(['9172@2000'])
})

it('names a sold gift through one misread glyph only when no other gift is close', () => {
  const gifts = [
    { id: '9001', texts: ['녹슨 커터나이프', 'Rusty Utility Knife'] },
    { id: '9002', texts: ['생체 맹독 바이알'] },
    { id: '9003', texts: ['회중시계 : 타입 E'] },
    { id: '9004', texts: ['회중시계 : 타입 Y'] },
    { id: '9005', texts: ['ガラスのロッカー'] },
  ]
  expect(sellGiftId('녹슨커터나이브', gifts)).toBe('9001')
  expect(sellGiftId('RustyUtilityKnite', gifts)).toBe('9001')
  expect(sellGiftId('생체맹독바이일', gifts)).toBe('9002')
  // One glyph from both pocket watches: no sale is named.
  expect(sellGiftId('회중시계타입F', gifts)).toBeNull()
  // Japanese OCR swaps (カ/ガ, 口/ロ, 一/ー) fold on both sides.
  expect(sellGiftId('カラスの口ツカ一', gifts)).toBe('9005')
  // Short reads keep the exact rule.
  expect(sellGiftId('커터나이', gifts)).toBeNull()
})

// Word boxes as the shipped OCR read them from sale samples (scripts/vision/replay_sale_samples.ts, 2026-10-02).
it('REQ-ASSIST-061 reads the cost in the 16:9 game view centred in the capture, whatever the window\'s shape', () => {
  const box = (text: string, left: number, top: number, width: number, height: number) => ({ text, left, top, width, height })
  // A nearly square game window (1498x1516 shared, 1280x1295 frame): the sell window sits mid-screen, the cost at 32% of the height.
  expect(sellCost([box('33233', 979, 393, 113, 37), box('E.G.O 기프트판매', 537, 408, 205, 31), box('등급순', 1035, 453, 53, 23),
    box('250', 934, 602, 49, 22), box('④252', 1024, 602, 50, 22), box('[아스라한 잔영]을(를) 코스트200에', 472, 658, 336, 27), box('282', 303, 1235, 29, 20)], 1280, 1295))
    .toEqual(['33233'])
  expect(sellCost([box('224-274', 943, 435, 156, 38), box('E.G.O 기프트 판매', 538, 462, 202, 29), box('등급순', 1032, 495, 54, 22),
    box('208', 931, 644, 49, 22), box('124', 1024, 645, 47, 21)], 1278, 1392)).toEqual(['224', '274'])
  // A 16:9 game in a window with its title bar (1282x752 shared): the cost box ends just below the top fifth.
  expect(sellCost([box('220520', 706, 86, 121, 27), box('E.G.O 기프트 판매', 403, 103, 152, 23), box('등급순', 777, 133, 39, 13),
    box('④100', 701, 243, 36, 17)], 960, 563)).toEqual(['220520'])
  // Full screen 16:9 reads as before.
  expect(sellCost([box('12501450', 964, 83, 150, 39), box('E.G.O기프트판매', 535, 105, 208, 33), box('등급순', 1035, 145, 54, 21),
    box('+100', 934, 294, 49, 21), box('④250', 1024, 294, 51, 21)], 1280, 720)).toEqual(['12501450'])
  // The position does not depend on the client language, and numbers at the top of a square capture are not the cost.
  expect(sellCost([box('683 783', 964, 393, 150, 39), box('Sell E.G.O Gift', 535, 405, 208, 33)], 1280, 1295)).toEqual(['683', '783'])
  expect(sellCost([box('683 783', 964, 83, 150, 39), box('Sell E.G.O Gift', 535, 405, 208, 33)], 1280, 1295)).toEqual([])
  // The title hangs on a chain and swings while the dialog opens and closes (here it dropped to the price list's row):
  // the cost stays where it is, and the gift prices next to the swung title are not read as the cost.
  expect(sellCost([box('E.G.O기프트판매', 535, 219, 208, 33), box('187', 1015, 83, 96, 39), box('201', 935, 239, 49, 23), box('200', 1024, 239, 48, 24)], 1280, 720))
    .toEqual(['187'])
  expect(sellCost([box('E.G.O 기프트판매', 537, 215, 204, 32), box('867', 1014, 394, 78, 37)], 1280, 1295)).toEqual(['867'])
})


import { describe, expect, it } from 'vitest'
import { dialogForResult, dialoglessFusionResult, fusionAnchors, fusionConfirmation, fusionDialogClosed, fusionMaterials, fusionWheelAnchors, fusionWheelCrop, fusionWheelRegions,
  isFusionSelectionScreen, wheelBandMatch, WHEEL_BAND_MIN, WHEEL_BAND_SIZE, fusionMaterialsToRemove, fusionResultFollows, fusionSlotRegions, fusionSlotRegionsFromAnchors, wheelSelectionSize, emptyWheelResult, popupEndBefore,
  FUSION_TITLE_KEEP_MS, onFusionScreen, showsFusionTitle, type SeenDialog }
  from '../../../lib/vision/fusion-evidence'

it('keeps the fusion screen on from its title when the scene classifier misses it (black UI theme)', () => {
  // OCR reads of a black-theme replay (2026-09-23 577-584 s): selection screen, dialog and result popup over it, then the shop.
  const selection = 'E.G.0 기프트 합성 3994 조합식 합성 안내 등급순 보유E.G.O 기프트 예상 결과 ? 소원 빌기 5 ×닫기 ~합성'
  const dialog = 'E.G.O 기프트 합성 선택한 기프트 3/3 예상 + | 선택한 E.G.O 기프트를 조합하시겠습니까? 취소 확인'
  const popup = 'E.G.O 기프트 합성 ××3994 합성 안내 등급순 E.G.0 기프트를 획득했습니다. [편성 1번,2번 인격 전용효과]'
  const shop = '상점 키워드 새로고침 329 다음층에서 49% 새로고침 특별한상점등장확률 15 90 구매 완료'
  // The shop's menu buttons read line by line; without whitespace they join into "기프트합성".
  const shopButtons = '기프트\n강화\n기프트\n합성\n기프트\n판매\n수감자\n회복\n판성'
  expect([selection, dialog, popup].every(showsFusionTitle)).toBe(true)
  expect(showsFusionTitle(shop)).toBe(false)
  expect(showsFusionTitle(shopButtons)).toBe(false)
  // Classified as something else, the screen still counts while its title was read moments ago.
  expect(onFusionScreen('enhance', 10_000, 10_000 + FUSION_TITLE_KEEP_MS - 1)).toBe(true)
  expect(onFusionScreen('enhance', 10_000, 10_000 + FUSION_TITLE_KEEP_MS)).toBe(false)
  expect(onFusionScreen(null, 0, 60_000)).toBe(false)
  expect(onFusionScreen('fusion', 0, 60_000)).toBe(true)
})

it('reads the material count only from the fusion confirmation dialog', () => {
  expect(fusionConfirmation('E.G.O 기프트 합성\n선택한 기프트 2/5\n예상\n선택한 E.G.O 기프트를 조합하시겠습니까?\n취소\n확인')).toEqual({ count: 2, capacity: 5 })
  expect(fusionConfirmation('선택한기프트 5/5 … 조합하시겠습니까')).toEqual({ count: 5, capacity: 5 })
  expect(fusionConfirmation('3/5\n선택한 기프트\n선택한 E.G.O기프트를 조합하시겠습니까?')).toEqual({ count: 3, capacity: 5 })
  expect(fusionConfirmation('E.G.O 기프트 합성\n선택한 기프트 2/5')).toBeNull()
  expect(fusionConfirmation('E.G.O 기프트를 획득했습니다.')).toBeNull()
  expect(fusionConfirmation('선택한 기프트 7/5 조합하시겠습니까')).toBeNull()
})

it('reads the normal shop (3 slots) and special shop (5 slots) dialogs with their own capacity', () => {
  expect(fusionConfirmation('E.G.O 기프트 합성\n선택한 기프트 2/3\n선택한 E.G.O 기프트를 조합하시겠습니까?')).toEqual({ count: 2, capacity: 3 })
  expect(fusionConfirmation('3/3\n선택한 기프트\n선택한 E.G.O기프트를 조합하시겠습니까?')).toEqual({ count: 3, capacity: 3 })
  expect(fusionConfirmation('선택한 기프트 4/5 조합하시겠습니까')).toEqual({ count: 4, capacity: 5 })
  // Counts above the capacity, zero, or other capacities are misreads, never a fusion.
  for (const bad of ['4/3', '5/3', '0/3', '0/5', '6/5', '2/4', '2/6', '12/3', '1/33']) {
    expect(fusionConfirmation(`선택한 기프트 ${bad} 선택한 E.G.O 기프트를 조합하시겠습니까?`), bad).toBeNull()
  }
})

it('places the special-shop material slots on the 16:9 game content at any capture size or letterbox', () => {
  const full = fusionSlotRegions(1920, 1080, 2, 5)
  expect(full).toEqual([{ x: 296, y: 464, size: 100 }, { x: 490, y: 464, size: 100 }])
  const small = fusionSlotRegions(1280, 720, 5, 5)!
  expect(small).toHaveLength(5)
  expect(small[4].x).toBeCloseTo(1074 * 2 / 3)
  // 16:10 capture with the game letterboxed: 60 px bars top and bottom.
  expect(fusionSlotRegions(1920, 1200, 1, 5)![0]).toEqual({ x: 296, y: 524, size: 100 })
  expect(fusionSlotRegions(1920, 1080, 0, 5)).toBeNull()
  expect(fusionSlotRegions(1920, 1080, 6, 5)).toBeNull()
})

it('places the normal-shop (3 slot) row at its own measured size, never the five-slot geometry', () => {
  // Measured on a 1920×1080 normal-shop recording: three 180 px icons, 324 px apart.
  expect(fusionSlotRegions(1920, 1080, 3, 3)).toEqual([{ x: 373, y: 458, size: 180 }, { x: 697, y: 458, size: 180 }, { x: 1021, y: 458, size: 180 }])
  expect(fusionSlotRegions(1920, 1080, 2, 3)).toHaveLength(2)
  expect(fusionSlotRegions(1920, 1080, 2, 3)![1]).not.toEqual(fusionSlotRegions(1920, 1080, 2, 5)![1])
  expect(fusionSlotRegions(1280, 720, 3, 3)![2]).toEqual({ x: 1021 * 2 / 3, y: 458 * 2 / 3, size: 120 })
  for (const [count, capacity] of [[4, 3], [0, 3], [6, 5], [2, 4], [1.5, 3]]) expect(fusionSlotRegions(1920, 1080, count, capacity)).toBeNull()
})

describe('materials of one fusion from the selection wheel and the dialog', () => {
  const read = (score: number, margin: number) => (id: string) => ({ id, score, margin })
  const strong = read(0.95, 0.4), accepted = read(0.82, 0.22), weak = read(0.72, 0.15), blank = { blank: true as const }
  const dialog = (slots: Parameters<typeof fusionMaterials>[0][number]['slots'], observedAt: number) => ({ view: 'dialog' as const, slots, observedAt })
  const wheel = (slots: Parameters<typeof fusionMaterials>[0][number]['slots'], observedAt: number) => ({ view: 'wheel' as const, slots, observedAt })

  it('confirms dialog slots from one strong read or accepted reads of two frames, never from one weaker read', () => {
    expect(fusionMaterials([dialog([strong('9001'), strong('9002')], 1000)], 2, 5)).toEqual(['9001', '9002'])
    expect(fusionMaterials([dialog([accepted('9001'), weak('9002')], 1000)], 2, 5)).toEqual([])
    expect(fusionMaterials([dialog([accepted('9001'), null], 1000), dialog([accepted('9001'), null], 1400)], 2, 5)).toEqual(['9001'])
    // The same frame read twice is not a second read.
    expect(fusionMaterials([dialog([accepted('9001')], 1000), dialog([accepted('9001')], 1000)], 1, 3)).toEqual([])
    // Two different materials read in one slot: unknown however strong.
    expect(fusionMaterials([dialog([strong('9001')], 1000), dialog([strong('9004')], 1400)], 1, 3)).toEqual([])
  })

  it('takes every selected material from the wheel when a quick confirm closes the dialog before its slots fill', () => {
    // Normal shop, quick confirm: the dialog only showed two icons; the wheel held all three.
    const reads = [wheel([strong('9111'), strong('9024'), strong('9115')], 900), dialog([strong('9115'), strong('9111'), blank], 1100)]
    expect(fusionMaterials(reads, 3, 3).sort()).toEqual(['9024', '9111', '9115'])
    // Special shop, recipe auto-fill: two of five positions, the rest empty.
    expect(fusionMaterials([wheel([blank, blank, strong('9409'), blank, strong('9408')], 900)], 2, 5)).toEqual(['9409', '9408'])
  })

  it('adds a material only the dialog showed when the last pick came after the newest wheel crop', () => {
    const reads = [wheel([strong('9005'), blank, strong('9089')], 900), dialog([strong('9005'), strong('9089'), strong('9031')], 1200)]
    expect(fusionMaterials(reads, 3, 3).sort()).toEqual(['9005', '9031', '9089'])
  })

  it('accepts a thin, dark icon read weakly only when the wheel and the dialog both show it', () => {
    // Measured live reads: rose 9159 0.67 on the wheel and 0.74 in the dialog; 9047 0.69 on the wheel, 0.82 in the dialog.
    const rose = [wheel([read(0.69, 0.16)('9047'), read(0.67, 0.17)('9159'), accepted('9236')], 900),
      dialog([strong('9236'), read(0.82, 0.32)('9047'), read(0.74, 0.25)('9159')], 1200)]
    expect(fusionMaterials(rose, 3, 3).sort()).toEqual(['9047', '9159', '9236'])
    expect(fusionMaterials([wheel([read(0.64, 0.2)('9159')], 900), dialog([read(0.74, 0.25)('9159')], 1200)], 1, 3)).toEqual([])
    expect(fusionMaterials([wheel([read(0.7, 0.09)('9159')], 900), dialog([read(0.74, 0.25)('9159')], 1200)], 1, 3)).toEqual([])
    // Dagger 9072: 0.71 / 0.20 and 0.70 / 0.21 in two wheel states either side of the starlight prompt.
    expect(fusionMaterials([wheel([blank, blank, read(0.71, 0.2)('9072')], 1000), wheel([blank, blank, read(0.7, 0.21)('9072')], 1600)], 2, 5)).toEqual(['9072'])
    expect(fusionMaterials([wheel([blank, blank, read(0.71, 0.2)('9072')], 1000), wheel([blank, blank, read(0.7, 0.21)('9072')], 1150)], 2, 5)).toEqual([])
    // Leads under 0.20 are not enough on repetition: the orb 9203 under the cursor read as 9769 at 0.80 / 0.16.
    expect(fusionMaterials([wheel([read(0.8, 0.16)('9769')], 1000), wheel([read(0.8, 0.163)('9769')], 1300)], 3, 5)).toEqual([])
    // Across views one read must lead by 0.15: two weak reads of one icon, each barely ahead, do not corroborate.
    expect(fusionMaterials([wheel([read(0.8, 0.14)('9769')], 1000), dialog([read(0.7, 0.12)('9769')], 1300)], 3, 5)).toEqual([])
    // Floor-1 wheel: far ahead of every other icon in one read (0.79 / 0.39) is enough on its own.
    expect(fusionMaterials([wheel([strong('9069'), read(0.81, 0.37)('9132'), read(0.79, 0.39)('9049')], 900)], 3, 3)).toEqual(['9069', '9132', '9049'])
    expect(fusionMaterials([wheel([weak('9159')], 900)], 1, 3)).toEqual([])
    expect(fusionMaterials([dialog([weak('9159')], 900), dialog([weak('9159')], 1300)], 1, 3)).toEqual([])
    // Weak reads of different materials in the two views corroborate nothing.
    expect(fusionMaterials([wheel([weak('9159')], 900), dialog([weak('9166')], 1200)], 1, 3)).toEqual([])
  })

  it('never counts blank slots, and keeps only the dialog when the wheel showed another selection', () => {
    expect(fusionMaterials([wheel([blank, blank, blank], 900), dialog([blank, blank], 1200)], 2, 3)).toEqual([])
    // Crops of an earlier (cancelled) selection: wheel and dialog together name more than the dialog count.
    const stale = [wheel([strong('9001'), strong('9002'), strong('9003')], 900), dialog([strong('9004'), strong('9005')], 1200)]
    expect(fusionMaterials(stale, 2, 3)).toEqual(['9004', '9005'])
    expect(fusionMaterials([wheel([strong('9001'), strong('9002'), strong('9003')], 900)], 2, 3)).toEqual([])
  })

  it('REQ-ASSIST-047 takes the newest accepted material of a wheel position when the player swapped it, but never mixes dialog reads', () => {
    // 2026-09-26 sample 8b74aa01: 9004 picked first, then replaced by 9061 before the dialog.
    const swapped = [wheel([accepted('9004'), blank, strong('9097')], 1000), wheel([accepted('9004'), blank, strong('9097')], 1300),
      wheel([strong('9061'), blank, strong('9097')], 2400), wheel([accepted('9061'), blank, strong('9097')], 2700)]
    expect(fusionMaterials(swapped, 2, 3).sort()).toEqual(['9061', '9097'])
    // An older accepted read after the newest one never brings the replaced material back.
    expect(fusionMaterials([wheel([strong('9061')], 2400), wheel([accepted('9004')], 1000)], 1, 3)).toEqual(['9061'])
    // Dialog slots do not change while it is up: two accepted materials there stay unknown.
    expect(fusionMaterials([dialog([strong('9001')], 1000), dialog([strong('9004')], 1400)], 1, 3)).toEqual([])
  })

  it('REQ-ASSIST-045 takes a fusion without a seen dialog as the materials the fullest wheel state held, not the shop capacity', () => {
    // 2026-09-26 sample e953322b (1684×948): a 2/5 special-shop fusion whose dialog no screen read caught.
    const reads = [wheel([blank, blank, strong('9020'), blank, blank], 900), wheel([blank, blank, strong('9020'), blank, accepted('9061')], 1300),
      wheel([blank, blank, strong('9020'), blank, accepted('9061')], 1700)]
    expect(wheelSelectionSize(reads)).toBe(2)
    const count = wheelSelectionSize(reads)
    expect(fusionMaterials(reads, count, 5)).toEqual(['9020', '9061'])
    // A slot that could not be read is still a selected material.
    expect(wheelSelectionSize([wheel([strong('9001'), null, blank], 900)])).toBe(2)
    // Dialog reads have their own count; no wheel state says nothing.
    expect(wheelSelectionSize([dialog([strong('9001'), strong('9002')], 900)])).toBe(0)
  })

  it('REQ-ASSIST-070 does not take the bonus popup after a fusion (Star Blessing) for a second fusion', () => {
    // Diagnoses of 2026-10-06 samples (2560x1440): the only wheel state between the fusion's result and the bonus popup is empty.
    expect(emptyWheelResult([wheel([blank, blank, blank, blank, blank], 0)], 5)).toBe(true)
    expect(emptyWheelResult([wheel([blank, blank, blank, blank, null], 0)], 5)).toBe(true)
    // Two filled positions in any state are a selection, read or not: a fusion whose dialog was missed.
    expect(emptyWheelResult([wheel([blank, blank, blank], 0), wheel([null, blank, weak('9020')], 300)], 3)).toBe(false)
    expect(emptyWheelResult([wheel([strong('9001'), strong('9002'), blank], 0)], 3)).toBe(false)
    // One material read (the last one was picked within a wheel sample of confirming): it is still taken as before.
    expect(emptyWheelResult([wheel([strong('9001'), blank, blank], 0)], 3)).toBe(false)
    // No wheel state read at all says nothing: such a result stays a held fusion.
    expect(emptyWheelResult([], 5)).toBe(false)
    expect(emptyWheelResult([dialog([blank, blank, blank], 0)], 3)).toBe(false)
  })

  it('REQ-ASSIST-070 leaves out wheel states first seen under the popup before the result', () => {
    // 1600x920 sample: result popup until 9,700, bonus popup captured at 10,000; the state of 8,727 was under the first popup.
    expect(popupEndBefore([4_000, 9_700], 10_000)).toBe(9_700)
    // The result's own popup ends after its capture and does not count; without an earlier popup every state qualifies.
    expect(popupEndBefore([9_700, 10_900], 10_000)).toBe(9_700)
    expect(popupEndBefore([10_900], 10_000)).toBe(0)
    expect(popupEndBefore([], 10_000)).toBe(0)
  })
})

describe('telling the selection screen from a dialog, popup or prompt over the wheel', () => {
  const size = WHEEL_BAND_SIZE
  // A synthetic result box: a riveted plate edge (outer ring) around changing content.
  const plate = (shift = 0, content = 0) => Float32Array.from({ length: size * size }, (_, index) => {
    const x = (index % size) - shift, y = Math.floor(index / size) - shift
    const edge = x < 4 || y < 4 || x >= size - 4 || y >= size - 4
    return edge ? ((x * 7 + y * 13) % 5) * 40 + ((x + y) % 3) * 15 : content + ((x * y) % 11) * 9
  })
  let seed = 3
  const noise = () => Float32Array.from({ length: size * size }, () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff) * 255 })

  it('matches the same plate whatever the box shows, up to a small shift, and not other content', () => {
    const reference = plate()
    expect(wheelBandMatch(plate(), reference)).toBeCloseTo(1, 5)
    expect(wheelBandMatch(plate(0, 120), reference)).toBeGreaterThan(0.95)
    expect(wheelBandMatch(plate(2), reference)).toBeGreaterThan(0.95)
    expect(wheelBandMatch(noise(), reference)).toBeLessThan(WHEEL_BAND_MIN)
    expect(wheelBandMatch(new Float32Array(size * size), reference)).toBeLessThan(WHEEL_BAND_MIN)
  })

  it('never lets a read name one gift in two slots (a covered wheel reads one texture as the same icon)', () => {
    const strong = (id: string) => ({ id, score: 0.94, margin: 0.26 })
    // A dialog over the wheel, read at the five wheel positions as 9007, 9007, 9007, 9007.
    expect(fusionMaterials([{ view: 'wheel', slots: [null, strong('9007'), strong('9007'), strong('9007'), strong('9007')], observedAt: 1000 }], 3, 5)).toEqual([])
    expect(fusionMaterials([{ view: 'wheel', slots: [strong('9001'), strong('9002')], observedAt: 1000 }], 2, 5)).toEqual(['9001', '9002'])
  })
})

describe('selection wheel geometry', () => {
  // Real GPU OCR lines of the selection screen (1920×1080): title and "소원 빌기".
  const title = { text: 'E.G.O 기프트 합성', left: 748, top: 127, width: 422, height: 62 }
  const wish = { text: '소원 빌기', left: 481, top: 734, width: 118, height: 47 }
  const screen = 'E.G.O 기프트 합성 3994 조합식 합성 안내 등급순 보유E.G.O 기프트 예상결과 IN 확정 90% 소원 빌기 5 닫기 합성'

  it('recognizes the selection screen, not its dialog or a popup over it', () => {
    expect(isFusionSelectionScreen(screen)).toBe(true)
    expect(isFusionSelectionScreen(`${screen} 선택한 E.G.O 기프트를 조합하시겠습니까?`)).toBe(false)
    expect(isFusionSelectionScreen(`${screen} E.G.O 기프트를 획득했습니다.`)).toBe(false)
    // The companion window shared beside the game: its gift list and acquisition notices keep the wheel readable.
    expect(isFusionSelectionScreen(`${screen} 이번 층 획득 가능 기프트 ✓ 획득 붉게 물든 목화`)).toBe(true)
    // The starlight prompt over the selection screen.
    expect(isFusionSelectionScreen(`${screen} 별빛을 5 소모하여 합성 확률을 증가시키겠습니까? 취소 확인`)).toBe(false)
    expect(isFusionSelectionScreen('상점 새로고침 키워드')).toBe(false)
    expect(fusionWheelAnchors([title, { text: '조합식', left: 966, top: 226, width: 74, height: 30 }, wish])).toEqual({ title, wish, titleWidth: 422 })
    expect(fusionWheelAnchors([title])).toBeNull()
  })

  it('places the measured 3 and 5 positions, from the frame or from the screen text under scaling and a title bar', () => {
    expect(fusionWheelRegions(1920, 1080, 3)).toEqual([{ x: 544, y: 308, size: 98 }, { x: 337, y: 515, size: 98 }, { x: 751, y: 515, size: 98 }])
    expect(fusionWheelRegions(1920, 1080, 5)).toHaveLength(5)
    expect(fusionWheelRegions(1920, 1080, 4)).toBeNull()
    const fromText = fusionWheelRegions(1920, 1080, 5, { title, wish })!
    fusionWheelRegions(1920, 1080, 5)!.forEach((region, index) => {
      expect(Math.abs(fromText[index].x - region.x)).toBeLessThan(3)
      expect(Math.abs(fromText[index].y - region.y)).toBeLessThan(3)
    })
    const move = (box: typeof title, scale: number, dx: number, dy: number) => ({ ...box, left: box.left * scale + dx, top: box.top * scale + dy, width: box.width * scale, height: box.height * scale })
    for (const [scale, dx, dy] of [[0.667, 320, 180], [1, 0, 32]]) {
      const moved = fusionWheelRegions(1920, 1112, 3, { title: move(title, scale, dx, dy), wish: move(wish, scale, dx, dy) })!
      const base = fusionWheelRegions(1920, 1080, 3, { title, wish })!
      moved.forEach((region, index) => {
        expect(region.x).toBeCloseTo(base[index].x * scale + dx, 0)
        expect(region.y).toBeCloseTo(base[index].y * scale + dy, 0)
      })
    }
  })

  it('keeps a crop that holds every position with room for the icon search, and nothing of the owned-gift list', () => {
    const crop = fusionWheelCrop(1920, 1080)
    for (const capacity of [3, 5]) for (const region of fusionWheelRegions(1920, 1080, capacity)!) {
      expect(region.x - region.size * 0.75).toBeGreaterThanOrEqual(crop.x)
      expect(region.y - region.size * 0.75).toBeGreaterThanOrEqual(crop.y)
      expect(region.x + region.size * 0.75).toBeLessThanOrEqual(crop.x + crop.width)
      expect(region.y + region.size * 0.75).toBeLessThanOrEqual(crop.y + crop.height)
    }
    // The owned-gift list starts at x ≈ 950 in the 1080p view.
    expect(crop.x + crop.width).toBeLessThan(950)
  })
})

it('treats a result no seen dialog explains as a fusion only between two fusion-screen reads', () => {
  const fusion = (at: number) => ({ at, fusion: true }), other = (at: number) => ({ at, fusion: false })
  // A dialog up 0.3 s between screen reads: the wheel screen before, the fusion screen with its popup after.
  expect(dialoglessFusionResult(10_000, fusion(9_400), fusion(10_500), false)).toBe(true)
  // A purchase: the shop screen before or after.
  expect(dialoglessFusionResult(10_000, other(9_400), fusion(10_500), false)).toBe(false)
  expect(dialoglessFusionResult(10_000, fusion(9_400), other(10_500), false)).toBe(false)
  // A seen dialog explains it: the ordinary dialog evidence applies instead.
  expect(dialoglessFusionResult(10_000, fusion(9_400), fusion(10_500), true)).toBe(false)
  // The fusion screen was left long ago, or nothing was read before.
  expect(dialoglessFusionResult(10_000, fusion(6_000), fusion(10_500), false)).toBe(false)
  expect(dialoglessFusionResult(10_000, undefined, fusion(10_500), false)).toBe(false)
})

it('pairs each result with the latest seen dialog that has none yet, so back-to-back fusions are not mixed up', () => {
  // Back-to-back fusions: the first dialog seen, its result 0.5 s later; the next dialog unseen, its result 3.5 s after.
  const first: SeenDialog = { firstAt: 1_000, lastSeenAt: 1_600 }
  expect(dialogForResult([first], 2_100)).toBe(first)
  first.resultAt = 2_100
  expect(dialogForResult([first], 5_100)).toBeNull()
  // A dialog seen only later but opened before the result still explains it; one closed without a result does not.
  expect(dialogForResult([first, { firstAt: 4_900, lastSeenAt: 4_900 }], 5_100)).toEqual({ firstAt: 4_900, lastSeenAt: 4_900 })
  expect(dialogForResult([{ firstAt: 1_000, lastSeenAt: 1_600, closedAt: 2_500 }], 3_000)).toBeNull()
  expect(dialogForResult([{ firstAt: 1_000, lastSeenAt: 1_600 }], 6_000)).toBeNull()
})

it('takes only an acquisition right after the dialog as its result, not a later purchase after cancelling', () => {
  const evidence = { materials: ['9001'], observedAt: 10_000, lastSeenAt: 11_000 }
  expect(fusionResultFollows(evidence, 11_400)).toBe(true)
  expect(fusionResultFollows(evidence, 15_000)).toBe(true)
  expect(fusionResultFollows(evidence, 15_001)).toBe(false)
  expect(fusionResultFollows(evidence, 9_000)).toBe(false)
  expect(fusionResultFollows(evidence, undefined)).toBe(false)
  // Closed without a result at 11 900 (cancelled): a purchase popup right after is not the result, an earlier popup is.
  expect(fusionResultFollows({ ...evidence, closedAt: 11_900 }, 12_500)).toBe(false)
  expect(fusionResultFollows({ ...evidence, closedAt: 11_900 }, 11_400)).toBe(true)
})

it('sees the dialog closed without a result only on a later screen without the dialog or an acquisition popup', () => {
  const fusionScreen = 'E.G.O 기프트 합성 3994 조합식 합성 안내 등급순'
  expect(fusionDialogClosed(fusionScreen, 11_800, 11_000)).toBe(true)
  // Too soon: the gap between the dialog closing and its result popup appearing.
  expect(fusionDialogClosed(fusionScreen, 11_500, 11_000)).toBe(false)
  expect(fusionDialogClosed(`${fusionScreen} E.G.O 기프트를 획득했습니다.`, 12_000, 11_000)).toBe(false)
  expect(fusionDialogClosed('선택한 기프트 ?/3 선택한 E.G.O 기프트를 조합하시겠습니까?', 12_000, 11_000)).toBe(false)
})

it('removes only identified owned materials; unowned vestiges are skipped, other unowned materials make it uncertain', () => {
  const vestiges = new Set(['9991', '9992'])
  expect(fusionMaterialsToRemove(['9001', '9002'], ['9001', '9002', '9003'], vestiges)).toEqual(['9001', '9002'])
  expect(fusionMaterialsToRemove(['9001', '9001'], ['9001', '9001'], vestiges)).toEqual(['9001', '9001'])
  expect(fusionMaterialsToRemove(['9001', '9001'], ['9001'], vestiges)).toBeNull()
  expect(fusionMaterialsToRemove(['9991', '9001'], ['9001'], vestiges)).toEqual(['9001'])
  expect(fusionMaterialsToRemove(['9991', '9992'], [], vestiges)).toEqual([])
  expect(fusionMaterialsToRemove(['9001', '9004'], ['9001'], vestiges)).toBeNull()
})

describe('slots placed from the dialog text', () => {
  // Real GPU OCR lines measured on a 1920×1080 dialog frame.
  const header = { text: '선택한 기프트', left: 522, top: 256, width: 282, height: 56, confidence: 90 }
  const count = { text: '3/5', left: 862, top: 252, width: 98, height: 62, confidence: 90 }
  const question = { text: '선택한 E.G.O기프트를 조합하시겠습니까?', left: 608, top: 741, width: 704, height: 39, confidence: 90 }
  const transform = (box: typeof header, scale: number, dx: number, dy: number) =>
    ({ ...box, left: box.left * scale + dx, top: box.top * scale + dy, width: box.width * scale, height: box.height * scale })

  it('finds the header and question lines, and matches the calibrated 1080p slots', () => {
    const anchors = fusionAnchors([count, header, question])!
    expect(anchors.header.left).toBe(522)
    const regions = fusionSlotRegionsFromAnchors(anchors, 3, 5)!
    const layout = fusionSlotRegions(1920, 1080, 3, 5)!
    regions.forEach((region, index) => {
      expect(Math.abs(region.x - layout[index].x)).toBeLessThan(4)
      expect(Math.abs(region.y - layout[index].y)).toBeLessThan(4)
      expect(Math.abs(region.size - layout[index].size)).toBeLessThan(2)
    })
  })

  it('follows a window title bar, a scaled game view or an off-centre dialog', () => {
    for (const [scale, dx, dy] of [[1, 0, 32], [0.667, 320, 180], [1.333, 0, 0], [0.75, 57, 91]]) {
      const moved = fusionSlotRegionsFromAnchors({ header: transform(header, scale, dx, dy), question: transform(question, scale, dx, dy) }, 2, 5)!
      const base = fusionSlotRegionsFromAnchors({ header, question }, 2, 5)!
      moved.forEach((region, index) => {
        expect(region.x).toBeCloseTo(base[index].x * scale + dx, 0)
        expect(region.y).toBeCloseTo(base[index].y * scale + dy, 0)
        expect(region.size).toBeCloseTo(base[index].size * scale, 0)
      })
    }
  })

  it('places the normal-shop slots from the same dialog lines (identical on the 3/3 dialog)', () => {
    // Real GPU OCR lines of a normal-shop 3/3 dialog frame: same header and question boxes as the special shop.
    const normal = fusionAnchors([{ ...header, left: 522, width: 278 }, { ...count, text: '3/3' }, question])!
    const regions = fusionSlotRegionsFromAnchors(normal, 3, 3)!
    fusionSlotRegions(1920, 1080, 3, 3)!.forEach((slot, index) => {
      expect(Math.abs(regions[index].x - slot.x)).toBeLessThan(4)
      expect(Math.abs(regions[index].y - slot.y)).toBeLessThan(4)
      expect(Math.abs(regions[index].size - slot.size)).toBeLessThan(3)
    })
    const moved = fusionSlotRegionsFromAnchors({ header: transform(normal.header as typeof header, 0.667, 320, 212), question: transform(question, 0.667, 320, 212) }, 3, 3)!
    moved.forEach((region, index) => expect(region.x).toBeCloseTo(regions[index].x * 0.667 + 320, 0))
  })

  it('does not trust inconsistent anchors or word-level reads', () => {
    expect(fusionSlotRegionsFromAnchors({ header, question: { ...question, width: 300 } }, 2, 5)).toBeNull()
    expect(fusionSlotRegionsFromAnchors({ header: question, question: header }, 2, 5)).toBeNull()
    expect(fusionSlotRegionsFromAnchors({ header, question }, 4, 3)).toBeNull()
    expect(fusionSlotRegionsFromAnchors({ header, question }, 6, 5)).toBeNull()
    expect(fusionAnchors([{ ...header, text: '선택한' }, { ...header, text: '기프트' }, question])).toBeNull()
    expect(fusionAnchors([header])).toBeNull()
  })
})

const normalized = (text: string) => text.normalize('NFKC').replace(/\s+/g, '')

/**
 * The starlight (별의 가호) screen before a run: its title with a word only that screen has (입장, 가호 전체 선택, 사용
 * 가능) in one read. The scene classifier learned the old red cards only (14 frames); the 2026-10 screen is blue, and the
 * text is the same in any colour. The title alone is not enough: it also names the bonus gift popup ("별의 가호 효과
 * 발동"). 입장 alone failed in a window too short for it (2026-11-04: "시지프 별의 가호 … 가호전체선택", no 입장).
 */
export const showsBlessingScreen = (text: string) => {
  const read = normalized(text)
  return read.includes('별의가호') && !read.includes('효과발동') && ['입장', '가호전체선택', '사용가능'].some(word => read.includes(word))
}

/**
 * The scene that screen stands for. It now comes after the formation and before the start gifts (recording 2026-10-23),
 * so it is part of the run start: the PiP leaves the formation for the start gifts there.
 */
export const BLESSING_SCENE = 'start_gift'

/** How long a read of that screen keeps it on after the capture it came from. */
export const BLESSING_KEEP_MS = 4000

export const onBlessingScreen = (readAt: number, now: number) => readAt > 0 && now - readAt < BLESSING_KEEP_MS

/**
 * Each blessing's starlight at its three levels (base, +, ++), in the screen's order: 100 to 109, five a row. The game's
 * start buff table; the planner's BLESSING_CONFIGS has the same (a test checks).
 */
export const BLESSING_COSTS: readonly (readonly [number, number, number])[] = [
  [10, 20, 30], [10, 20, 30], [20, 40, 60], [20, 40, 60], [30, 60, 90], [30, 60, 90], [40, 80, 120], [40, 80, 120], [50, 100, 150], [60, 120, 180],
]

// Card boxes on a 1920x1080 frame (the screen scales with min(w/1920, h/1080), centred; 1440x1080 and 1280x720 checked):
// the left edge, the top and bottom of each row, and the + / ++ buttons' rows
const CARD_LEFT = [210, 508, 806, 1104, 1402]
const CARD_ROWS = [{ top: 232, bottom: 552, buttons: 505 }, { top: 590, bottom: 910, buttons: 864 }]
/**
 * A selected card's border is lit. The brightest column of its left edge: 210 to 228 taken, 118 not, on 1920x1080, 1440x1080
 * and 1280x720 client captures; 136 to 179 taken, 91 to 110 not, on a 1280x720 recording of the real game (a thinner line).
 */
export const BLESSING_SELECTED_MIN = 128
/** A level's button text turns orange: about 140 of its 108x32 pixels on the samples, none otherwise. */
const ORANGE_SHARE = 0.01

interface Rgba { data: ArrayLike<number>; width: number; height: number }

/**
 * The blessings as the screen shows them: for each card 0 (not taken) or its level 1 to 3 (base, +, ++). Clicking a card
 * takes it (its border lights); + and ++ only set the level, taken or not (USER 2026-11-04). null when the cards are not
 * plainly shown (a popup or a fade dims them all), or not where they belong (a capture with more than the game in it: the
 * cards' tops are checked against the black above them): then nothing is read rather than a cheaper set. `titleBar`: a
 * window share's title bar rows (`titleBarRows`), the game below it.
 */
export function readBlessingCards(image: Rgba, titleBar = 0): number[] | null {
  const s = Math.min(image.width / 1920, (image.height - titleBar) / 1080)
  const ox = (image.width - 1920 * s) / 2, oy = titleBar + (image.height - titleBar - 1080 * s) / 2
  const at = (x: number, y: number) => (Math.round(oy + y * s) * image.width + Math.round(ox + x * s)) * 4
  const mean = (x0: number, y0: number, x1: number, y1: number) => {
    let sum = 0, n = 0
    for (let y = y0; y < y1; y += 1 / s) for (let x = x0; x < x1; x += 2 / s) { const i = at(x, y); sum += (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3; n++ }
    return n ? sum / n : 0
  }
  // the brightest column's mean: the border is a line one or two pixels wide wherever the scaling puts it
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    let best = 0
    for (let x = x0; x < x1; x += 1 / s) {
      let sum = 0, n = 0
      for (let y = y0; y < y1; y += 2 / s) { const i = at(x, y); sum += (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3; n++ }
      if (n) best = Math.max(best, sum / n)
    }
    return best
  }
  const orange = (x0: number, y0: number, x1: number, y1: number) => {
    let hit = 0, n = 0
    for (let y = y0; y < y1; y += 1 / s) for (let x = x0; x < x1; x += 1 / s) {
      const i = at(x, y), r = image.data[i], g = image.data[i + 1], b = image.data[i + 2]
      if (r > 200 && g > 110 && g < 210 && b < 100) hit++
      n++
    }
    return n ? hit / n : 0
  }
  const brightest = (x0: number, y0: number, x1: number, y1: number) => {
    let max = 0
    for (let y = y0; y < y1; y += 1 / s) for (let x = x0; x < x1; x += 1 / s) { const i = at(x, y); max = Math.max(max, Math.min(image.data[i], image.data[i + 1], image.data[i + 2])) }
    return max
  }
  const levels: number[] = []
  let lit = 0, framed = 0
  for (const row of CARD_ROWS) for (const left of CARD_LEFT) {
    // the card starts where it should: black just above its top (about 9), its face just below (60 to 90)
    if (mean(left + 30, row.top - 10, left + 230, row.top - 2) < 25 && mean(left + 30, row.top + 5, left + 230, row.top + 15) > 40) framed++
    // the name in white (about 200 at its brightest; a popup over the screen halves it)
    if (brightest(left + 90, row.top + 45, left + 255, row.top + 85) > 160) lit++
    const taken = edge(left - 6, row.top + 20, left + 10, row.bottom - 20) >= BLESSING_SELECTED_MIN
    const plus = orange(left + 18, row.buttons, left + 126, row.buttons + 32) > ORANGE_SHARE
    const plusPlus = orange(left + 139, row.buttons, left + 247, row.buttons + 32) > ORANGE_SHARE
    levels.push(taken ? plusPlus ? 3 : plus ? 2 : 1 : 0)
  }
  return lit >= 8 && framed >= 8 ? levels : null
}

/** The starlight the taken blessings cost. */
export const blessingSpent = (levels: readonly number[]) =>
  levels.reduce((sum, level, i) => sum + (level ? BLESSING_COSTS[i]?.[level - 1] ?? 0 : 0), 0)

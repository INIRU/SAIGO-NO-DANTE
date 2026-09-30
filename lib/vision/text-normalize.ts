/**
 * Text as compared between an OCR read and game text: NFKC, lower case, letters and digits only. Japanese glyphs that OCR
 * swaps are folded the same way on both sides: voicing marks and the long-vowel mark are dropped (ブ/プ, lost ー), small
 * kana become full size (ッ/ツ), and kanji or kana drawn alike share one form (力/カ, 口/ロ, 工/エ, シ/ツ, ソ/ン). Korean and
 * Latin text is unchanged apart from case, spacing and punctuation.
 */
const LOOKALIKES: Record<string, string> = {
  力: 'カ', 口: 'ロ', 工: 'エ', 二: 'ニ', 卜: 'ト', 八: 'ハ', 夕: 'タ', へ: 'ヘ', り: 'リ', シ: 'ツ', ソ: 'ン',
  ァ: 'ア', ィ: 'イ', ゥ: 'ウ', ェ: 'エ', ォ: 'オ', ッ: 'ツ', ャ: 'ヤ', ュ: 'ユ', ョ: 'ヨ', ヮ: 'ワ', ヵ: 'カ', ヶ: 'ケ',
  ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お', っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ',
}
const LOOKALIKE = new RegExp(`[${Object.keys(LOOKALIKES).join('')}]`, 'gu')
const KANA = /[぀-ヿ]/u

export function ocrNormalized(value: string): string {
  const text = value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  if (!KANA.test(text)) return text
  return text.normalize('NFD').replace(/[゙゚ー一]/gu, '').normalize('NFC')
    .replace(LOOKALIKE, glyph => LOOKALIKES[glyph])
}

/**
 * Unity rich-text tags of the game's text (<color=#ebcaa2>, </color>, <b>, <size=120%>, <sprite name="...">, ...). They
 * style the text and never show on screen, so they are removed before comparison instead of leaving "colorebcaa2".
 */
const RICH_TEXT_TAG = /<\/?(?:color|size|b|i|u|s|sprite|style|link|nobr|material|font|mark|sup|sub|align|voffset|cspace|mspace|indent|line-height|pos|width|alpha|gradient|lowercase|uppercase|smallcaps|noparse)\b[^<>]*>/giu
/** Placeholders such as {0} or the stored {{sinner}} token (a sinner's name) show other text on screen. */
const PLACEHOLDER = /\{\{[a-z]+\}\}|\{\d+(?::[A-Za-z]\d*)?\}/gu

/**
 * Game text as the pieces the screen shows, normalized: tags removed, split at placeholders (the name shown in their
 * place is unknown, so no compared window may span one). Empty pieces are dropped.
 */
export function gameTextPieces(value: string): string[] {
  return value.replace(RICH_TEXT_TAG, '').split(PLACEHOLDER).map(ocrNormalized).filter(Boolean)
}

/** Levenshtein distance between glyph arrays, stopping once it exceeds `limit` (then `limit + 1`). */
export function editDistance(source: readonly string[], target: readonly string[], limit: number): number {
  if (Math.abs(source.length - target.length) > limit) return limit + 1
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index)
  for (let row = 1; row <= source.length; row++) {
    const current = [row]
    let smallest = row
    for (let column = 1; column <= target.length; column++) {
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1,
        previous[column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1))
      smallest = Math.min(smallest, current[column])
    }
    if (smallest > limit) return limit + 1
    previous = current
  }
  return previous[target.length]
}

/**
 * The one id whose name is within one glyph of `read` while every other id's names are at least three glyphs away
 * (reads of at least `minLength` glyphs). A misread glyph then still names the item, and never one of two look-alikes.
 */
export function nearestName(read: string, names: readonly { id: string; name: string }[], minLength = 6): string | null {
  const glyphs = [...read]
  if (glyphs.length < minLength) return null
  let best: { id: string; distance: number } | null = null
  let runnerUp = Infinity
  for (const item of names) {
    const distance = editDistance(glyphs, [...item.name], 3)
    if (!best || distance < best.distance) {
      if (best && best.id !== item.id) runnerUp = Math.min(runnerUp, best.distance)
      best = { id: item.id, distance }
    } else if (item.id !== best.id) runnerUp = Math.min(runnerUp, distance)
  }
  return best && best.distance <= 1 && runnerUp >= 3 ? best.id : null
}

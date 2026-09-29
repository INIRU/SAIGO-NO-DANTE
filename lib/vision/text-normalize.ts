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
/** Placeholders such as {0} (a sinner's name) show other text on screen. */
const PLACEHOLDER = /\{\d+\}/gu

/**
 * Game text as the pieces the screen shows, normalized: tags removed, split at placeholders (the name shown in their
 * place is unknown, so no compared window may span one). Empty pieces are dropped.
 */
export function gameTextPieces(value: string): string[] {
  return value.replace(RICH_TEXT_TAG, '').split(PLACEHOLDER).map(ocrNormalized).filter(Boolean)
}

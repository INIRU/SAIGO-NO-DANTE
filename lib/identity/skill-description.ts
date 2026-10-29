
import { getGameUiAsset } from '@/lib/utils/game-ui'
import type { SkillCoin } from '@/lib/types'
import { hasVisibleGameText, mayBeRawGameText, splitCoinBlocks, splitGameTextLines } from '@/lib/game-text/rich-text'

interface CoinSection {
  coinNum: number
  isUnbreakable: boolean
  lines: string[]
}

const UNBREAKABLE_PATTERNS = ['파괴 불가 코인', 'Unbreakable Coin', '破壊不可コイン']
// Game text marks an unbreakable coin with a line that starts with [SuperCoin] (maybe after tags). A sentence that only
// mentions it ("If this is a [SuperCoin], …") is not the marker.
const SUPER_COIN_LINE = /^((?:<[^<>]*>)*)\[SuperCoin\]/
const COIN_LINE = /^\[(코인|Coin|コイン)\s?(\d+)\]\s*(.*)/

function isUnbreakableText(text: string): boolean {
  const line = text.trim()
  return SUPER_COIN_LINE.test(line) || UNBREAKABLE_PATTERNS.some(p => line.startsWith(p))
}

/** True when a coin's text holds the unbreakable marker: the older wording or a [SuperCoin] line of game text. */
export function isUnbreakableCoinText(text?: string | null): boolean {
  return !!text && text.split('\n').some(isUnbreakableText)
}

function stripUnbreakablePrefix(text: string): string {
  const line = text.trim()
  if (SUPER_COIN_LINE.test(line)) {
    const rest = line.replace(SUPER_COIN_LINE, '$1').trim()
    return hasVisibleGameText(rest) ? rest : ''
  }
  for (const p of UNBREAKABLE_PATTERNS) {
    if (line.startsWith(p)) return line.slice(p.length).trim()
  }
  return text
}

function addCoinLine(coin: CoinSection, line: string) {
  if (isUnbreakableText(line)) {
    coin.isUnbreakable = true
    const rest = stripUnbreakablePrefix(line)
    if (rest) coin.lines.push(rest)
  } else coin.lines.push(line)
}

/**
 * A stored skill description as its main lines and per-coin sections. Two stored forms are read: game text, where each
 * coin's text sits in a `<coin=N>…</coin>` block after the main text, and the older text, where a line starting
 * `[코인 N]` begins a coin and the lines after it belong to it. Lines are split so each is balanced on its own (see
 * `splitGameTextLines`); every line is drawn separately by the formatter.
 */
export function parseSkillDescription(description: string) {
  const { main, coins } = splitCoinBlocks(description)
  const globalEffects: string[] = []
  const paragraphBreaks = new Set<number>()
  const coinSections: CoinSection[] = []
  let currentCoin: CoinSection | null = null
  let sawEmptyLine = false

  for (const line of splitGameTextLines(main)) {
    const coinMatch = line.match(COIN_LINE)
    if (coinMatch) {
      currentCoin = { coinNum: parseInt(coinMatch[2]), isUnbreakable: false, lines: [] }
      coinSections.push(currentCoin)
      sawEmptyLine = false
      const content = coinMatch[3].trim()
      if (content) addCoinLine(currentCoin, content)
    } else if (currentCoin && line.trim()) {
      addCoinLine(currentCoin, line.trim())
    } else if (line.trim()) {
      if (sawEmptyLine && globalEffects.length > 0) {
        paragraphBreaks.add(globalEffects.length)
      }
      globalEffects.push(line.trim())
      sawEmptyLine = false
    } else if (!currentCoin) {
      sawEmptyLine = true
    }
  }

  for (const { coinNum, text } of coins) {
    const coin: CoinSection = { coinNum, isUnbreakable: false, lines: [] }
    for (const line of splitGameTextLines(text)) if (line.trim()) addCoinLine(coin, line.trim())
    coinSections.push(coin)
  }

  return { globalEffects, coinSections, paragraphBreaks }
}

/**
 * What a place that draws a description line by line (a tooltip) iterates: each main line, then each coin block whole
 * (`<coin=N>…</coin>`, so GameText draws its label and keeps its lines together). The older text is one block per line;
 * `coinStart` marks where a coin begins, for a divider.
 */
export function skillDescriptionBlocks(description: string): { text: string; coinStart: boolean }[] {
  const { main, coins } = splitCoinBlocks(description)
  return [
    ...splitGameTextLines(main).map(text => ({ text, coinStart: COIN_LINE.test(text) })),
    ...coins.map(({ coinNum, text }) => ({ text: `<coin=${coinNum}>${text}</coin>`, coinStart: true })),
  ]
}

/**
 * An E.G.O skill's description as the normal effect and the effect text of each coin (index 0 = coin 1; a coin without
 * text is ''). Game text: the main text and each `<coin=N>` block as written. The older text: lines are trimmed, blank
 * lines dropped and the lines after a `[코인 N]` line join that coin.
 */
export function splitEgoSkillDescription(description: string | null | undefined): { normalEffect: string; coinEffects: string[] } {
  const desc = description ?? ''
  const { main, coins } = splitCoinBlocks(desc)
  const lines = desc.split('\n')
  if (coins.length > 0 || (!lines.some(line => COIN_LINE.test(line)) && mayBeRawGameText(desc))) {
    const coinEffects: string[] = []
    for (const { coinNum, text } of coins) {
      if (coinNum < 1 || coinNum > 50) continue
      while (coinEffects.length < coinNum) coinEffects.push('')
      coinEffects[coinNum - 1] = text.trim()
    }
    return { normalEffect: main.trim(), coinEffects }
  }
  let normalEffect = ''
  const coinEffects: string[] = []
  let lastCoinIdx = -1
  for (const line of lines) {
    const coinMatch = line.match(COIN_LINE)
    if (coinMatch) {
      const idx = parseInt(coinMatch[2]) - 1
      while (coinEffects.length <= idx) coinEffects.push('')
      coinEffects[idx] = coinMatch[3].trim()
      lastCoinIdx = idx
    } else if (line.trim() && lastCoinIdx >= 0) {
      coinEffects[lastCoinIdx] += '\n' + line.trim()
    } else if (line.trim()) {
      normalEffect += (normalEffect ? '\n' : '') + line.trim()
    }
  }
  return { normalEffect, coinEffects }
}

/** Coin indices are zero based in every renderer. */
export function unbreakableCoinIndices(description?: string | null): Set<number> {
  return new Set(parseSkillDescription(description ?? '').coinSections
    .filter(coin => coin.isUnbreakable).map(coin => coin.coinNum - 1))
}

/**
 * Which coins cannot break. The skill's coin_list (the game's coin data, one entry per coin) decides when the sync has
 * filled it; rows without one keep reading the description text.
 */
export function unbreakableCoinSet(skill: { description?: string | null; coin_list?: readonly SkillCoin[] | null }): Set<number> {
  const coins = skill.coin_list
  if (!coins?.length) return unbreakableCoinIndices(skill.description)
  return new Set(coins.flatMap((coin, index) => coin.unbreakable ? [index] : []))
}

/** "+7", "-12" or "×2" per coin from the game's coin data (operator ADD/SUB/MUL); empty without a coin_list. */
export function coinPowerLabels(skill: { coin_list?: readonly SkillCoin[] | null }): string[] {
  return (skill.coin_list ?? []).map(coin => (coin.operator === 'SUB' ? '-' : coin.operator === 'MUL' ? '×' : '+') + coin.scale)
}

export const COIN_IMAGES = { normal: getGameUiAsset('coins/normal'), unbreakable: getGameUiAsset('coins/unbreakable') } as const

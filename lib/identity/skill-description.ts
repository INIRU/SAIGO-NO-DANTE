
import { getGameUiAsset } from '@/lib/utils/game-ui'
interface CoinSection {
  coinNum: number
  isUnbreakable: boolean
  lines: string[]
}

const UNBREAKABLE_PATTERNS = ['파괴 불가 코인', 'Unbreakable Coin', '破壊不可コイン']

function isUnbreakableText(text: string): boolean {
  return UNBREAKABLE_PATTERNS.some(p => text === p || text.startsWith(p))
}

function stripUnbreakablePrefix(text: string): string {
  for (const p of UNBREAKABLE_PATTERNS) {
    if (text.startsWith(p)) return text.slice(p.length).trim()
  }
  return text
}

export function parseSkillDescription(description: string) {
  const lines = description.split('\n')
  const globalEffects: string[] = []
  const paragraphBreaks = new Set<number>()
  const coinSections: CoinSection[] = []
  let currentCoin: CoinSection | null = null
  let sawEmptyLine = false

  for (const line of lines) {
    const coinMatch = line.match(/^\[(코인|Coin|コイン)\s?(\d+)\]\s*(.*)/)
    if (coinMatch) {
      currentCoin = { coinNum: parseInt(coinMatch[2]), isUnbreakable: false, lines: [] }
      coinSections.push(currentCoin)
      sawEmptyLine = false
      const content = coinMatch[3].trim()
      if (isUnbreakableText(content)) {
        currentCoin.isUnbreakable = true
        const rest = stripUnbreakablePrefix(content)
        if (rest) currentCoin.lines.push(rest)
      } else if (content) {
        currentCoin.lines.push(content)
      }
    } else if (currentCoin && line.trim()) {
      const content = line.trim()
      if (isUnbreakableText(content)) {
        currentCoin.isUnbreakable = true
        const rest = stripUnbreakablePrefix(content)
        if (rest) currentCoin.lines.push(rest)
      } else currentCoin.lines.push(content)
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

  return { globalEffects, coinSections, paragraphBreaks }
}

/** Coin indices are zero based in every renderer. */
export function unbreakableCoinIndices(description?: string | null): Set<number> {
  return new Set(parseSkillDescription(description ?? '').coinSections
    .filter(coin => coin.isUnbreakable).map(coin => coin.coinNum - 1))
}

export const COIN_IMAGES = { normal: getGameUiAsset('coins/normal'), unbreakable: getGameUiAsset('coins/unbreakable') } as const
export const UNBREAKABLE_COIN_COLOR = '#e52b2b'

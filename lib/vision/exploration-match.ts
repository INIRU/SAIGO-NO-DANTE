import type { OcrWord } from './ocr-match'

export interface ExplorationThemeReference { id: string; texts: string[] }

const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Floor from the exploration banner ("N층 탐사 중"). Tesseract often reads 층 as 증 and 탐 as 람, but the digits and
 * the following 사 must be present; theme selection lists never show this banner.
 */
export function explorationFloor(text: string): number | null {
  const match = /(?:^|[^0-9])([1-9][0-9]?)[층증충][탐람담]사/u.exec(text.normalize('NFKC').replace(/\s+/g, ''))
  if (!match) return null
  const floor = Number(match[1])
  return floor <= 15 ? floor : null
}

/**
 * Floor named by a pack selection header ("N층 테마팩 선택"), read line by line: digits of a neighbouring line (a timer
 * such as "9:02" above it) must not join the floor number, so the number needs a non-digit before it.
 */
export function themeSelectionHeaderFloor(text: string): number | null {
  for (const line of text.normalize('NFKC').split(/\r?\n/)) {
    const match = /(?:^|[^0-9])([1-9][0-9]?)[층증]테마팩선택/u.exec(line.replace(/\s+/g, ''))
    if (match && Number(match[1]) <= 15) return Number(match[1])
  }
  return null
}

/**
 * Theme ids named by the first word group on the line under the banner. Distant trailing marks are outside the group;
 * misreads match only when a single pack name is unambiguously one edit away.
 */
export function explorationThemeIds(words: OcrWord[], themes: ExplorationThemeReference[]): string[] {
  const readable = words.filter(word => /[\p{L}\p{N}]/u.test(word.text) && [word.left, word.width, word.height].every(Number.isFinite))
    .sort((left, right) => left.left - right.left)
  if (!readable.length) return []
  const height = Math.max(...readable.map(word => word.height))
  const group = [readable[0]]
  for (const word of readable.slice(1)) {
    const previous = group[group.length - 1]
    if (word.left - (previous.left + previous.width) > height * 1.2) break
    group.push(word)
  }
  const name = normalized(group.map(word => word.text).join(''))
  if ([...name].length < 2) return []
  const exact = themes.filter(theme => theme.texts.some(text => normalized(text) === name)).map(theme => theme.id)
  if (exact.length) return exact
  // The dim line over a moving map is often one glyph off. Only names of 4+ glyphs within one edit qualify, and every
  // other pack name must stay 3+ edits away, so near-identical packs (e.g. numbered lines) never match this way.
  if ([...name].length < 4) return []
  let best = Infinity, runnerUp = Infinity
  let bestText = ''
  for (const text of new Set(themes.flatMap(theme => theme.texts.map(normalized)))) {
    if ([...text].length < 4) continue
    const distance = editDistance(name, text)
    if (distance < best) { runnerUp = best; best = distance; bestText = text }
    else if (distance < runnerUp) runnerUp = distance
  }
  if (best > 1 || runnerUp < 3) return []
  return themes.filter(theme => theme.texts.some(text => normalized(text) === bestText)).map(theme => theme.id)
}

function editDistance(left: string, right: string): number {
  const source = [...left], target = [...right]
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index)
  for (let row = 1; row <= source.length; row++) {
    const current = [row]
    for (let column = 1; column <= target.length; column++) current[column] = Math.min(previous[column] + 1,
      current[column - 1] + 1, previous[column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1))
    previous = current
  }
  return previous[target.length]
}

/** Independent reads of the same theme line must agree; one unreadable read does not veto the other. */
export function explorationThemeMatch(reads: OcrWord[][], themes: ExplorationThemeReference[]): string[] {
  const matches = reads.map(read => explorationThemeIds(read, themes).sort()).filter(ids => ids.length)
  if (!matches.length) return []
  const key = matches[0].join('|')
  return matches.every(ids => ids.join('|') === key) ? matches[0] : []
}

export interface ExplorationObservation { floor: number; themeIds: string[]; observedAt: number }

/**
 * Two separate readable captures within three minutes (one floor visit) agreeing on floor and theme confirm the banner;
 * pack reads are sparse on a moving map, and any disagreeing readable capture restarts the chain.
 */
export function confirmsExploration(previous: ExplorationObservation | null, current: ExplorationObservation): boolean {
  const elapsed = previous ? current.observedAt - previous.observedAt : -1
  return previous !== null && previous.floor === current.floor && current.themeIds.length > 0 &&
    previous.themeIds.join('|') === current.themeIds.join('|') && elapsed >= 1000 && elapsed <= 180000
}

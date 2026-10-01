import type { SupportedLang } from '@/lib/i18n/types'

// Japanese may break between characters, but not before these (kinsoku) and not inside a Latin word such as "BokGak".
const NO_BREAK_BEFORE = new Set([...'ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ、。・，．）」』】〉》!?！？:：;；'])
const LATIN = /[A-Za-z0-9#&'.]/
const PREFERRED_AFTER = new Set([...'、，'])

/** Indexes where a title may break into a second line (the break goes before text[index]). */
export function titleBreakPoints(text: string, lang: SupportedLang): number[] {
  const points: number[] = []
  for (let i = 1; i < text.length; i++) {
    const prev = text[i - 1]
    const next = text[i]
    if (next === ' ') continue
    if (prev === ' ') { points.push(i); continue }
    if (lang !== 'ja') continue
    if (NO_BREAK_BEFORE.has(next)) continue
    if (LATIN.test(prev) && LATIN.test(next)) continue
    points.push(i)
  }
  return points
}

/**
 * The most balanced two-line split of a title (the widest line as short as possible), or null when it cannot break.
 * `measure` returns a string's width at any fixed size.
 */
export function splitTitleInTwo(text: string, lang: SupportedLang, measure: (s: string) => number): [string, string] | null {
  let best: { lines: [string, string]; widest: number } | null = null
  for (const at of titleBreakPoints(text, lang)) {
    const lines: [string, string] = [text.slice(0, at).trimEnd(), text.slice(at).trimStart()]
    if (!lines[0] || !lines[1]) continue
    // A break after a space or Japanese comma reads naturally; prefer it unless another split is >15% narrower.
    const natural = text[at - 1] === ' ' || PREFERRED_AFTER.has(text[at - 1])
    const widest = Math.max(measure(lines[0]), measure(lines[1])) * (natural ? 0.85 : 1)
    if (!best || widest < best.widest) best = { lines, widest }
  }
  return best?.lines ?? null
}

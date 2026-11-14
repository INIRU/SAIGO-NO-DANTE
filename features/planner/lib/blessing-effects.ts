type EffectTone = 'normal' | 'term' | 'diff'
type EffectSegment = { text: string; tone: EffectTone }

const NUMBER = /[+-]?\d+(?:\/\d+)*(?:~\d+)?%?(?:층|회|개|등급)?/g

/**
 * One blessing effect line, cut where its colour changes. Terms are what the game colours (`<k>…</k>` in the
 * messages, copied by scripts/data/mark-blessing-terms.py). From the second level on (`previousEffects` = the level
 * below), the part that differs from the same line of the level below is a change, shown on its numbers (or on all of
 * it when it has none). A line the level below also has does not change; a line it lacks is all new.
 */
export function blessingEffectSegments(effect: string, previousEffects: string[] | undefined, index: number): EffectSegment[] {
  let text = '', inTerm = false
  const tones: EffectTone[] = []
  for (const part of effect.split(/(<\/?k>)/)) {
    if (part === '<k>' || part === '</k>') { inTerm = part === '<k>'; continue }
    text += part
    for (let i = 0; i < part.length; i++) tones.push(inTerm ? 'term' : 'normal')
  }

  const previous = previousEffects?.map(line => line.replace(/<\/?k>/g, ''))
  if (previous && !previous.includes(text)) {
    const before = previous[index] ?? ''
    let start = 0, end = text.length, beforeEnd = before.length
    while (start < end && start < beforeEnd && text[start] === before[start]) start++
    while (end > start && beforeEnd > start && text[end - 1] === before[beforeEnd - 1]) { end--; beforeEnd-- }
    const numbers = [...text.matchAll(NUMBER)].map(m => [m.index, m.index + m[0].length])
    // A change that cuts into a number takes the whole number ("+150" → "+250" is "+250", not "2").
    for (const [from, to] of numbers) if (from < end && to > start) { start = Math.min(start, from); end = Math.max(end, to) }
    const changed = numbers.filter(([from, to]) => from >= start && to <= end)
    for (const [from, to] of changed.length ? changed : [[start, end]]) tones.fill('diff', from, to)
  }

  const segments: EffectSegment[] = []
  for (let i = 0; i < text.length; i++) {
    const last = segments.at(-1)
    if (last?.tone === tones[i]) last.text += text[i]
    else segments.push({ text: text[i], tone: tones[i] })
  }
  return segments
}

// The line of a gift's effect text that states its head-count condition ("검계 소속 인격이 3인 이상일 때", "3 or more",
// "3人以上"), in the page language.
const CONDITION_COUNT = /\d+\s*(?:인|명)\s*이상|\d+\s*or more|\d+\s*(?:人|名)以上/i

/**
 * Which effect lines a gift's condition decides (game text): the line stating it, and with it — when only some effects
 * need it (partial) — the "- …" lines right under it; otherwise every line. Null when no line states a count.
 */
export function conditionLines(lines: readonly string[], partial: boolean): { condition: number; gated: number[] } | null {
  const condition = lines.findIndex(line => CONDITION_COUNT.test(line))
  if (condition < 0) return null
  if (!partial) return { condition, gated: lines.map((_, i) => i) }
  const gated = [condition]
  for (let i = condition + 1; i < lines.length && /^\s*-/.test(lines[i]); i++) gated.push(i)
  return { condition, gated }
}

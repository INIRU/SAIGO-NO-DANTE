import type { MdEventChoice } from '@/components/mirror-dungeon/types'

export function groupEventChoices(rows: readonly MdEventChoice[]): MdEventChoice[][] {
  const groups = new Map<number, MdEventChoice[]>()
  for (const row of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const index = row.option_index ?? Math.floor(row.sort_order / 100)
    if (!groups.has(index)) groups.set(index, [])
    groups.get(index)!.push(row)
  }
  return [...groups.values()]
}

export function eventResultCondition(raw: string | null | undefined, lang: string): string {
  if (!raw || raw === 'Prob_1') return ''
  const number = Number(raw.match(/-?\d+(?:\.\d+)?$/)?.[0])
  if (raw.startsWith('Prob_')) return `${Number((number * 100).toFixed(2))}%`
  const pick = (ko: string, en: string, ja: string) => lang === 'en' ? en : lang === 'ja' ? ja : ko
  if (raw.startsWith('MpAverage_')) return pick('평균 정신력', 'Average SP', '平均精神力') + ` ${raw.includes('NotLessThan') ? '≥' : '<'} ${number}`
  if (raw.startsWith('Failed_')) return pick('실패 횟수', 'Failures', '失敗回数') + ` ${raw.includes('NotLessThan') ? '≥' : '<'} ${number}`
  if (raw.startsWith('ProbTimesRepeatCount_')) return number > 0
    ? pick(`반복 횟수 × ${number * 100}%`, `Repeats × ${number * 100}%`, `反復回数 × ${number * 100}%`)
    : pick(`100% − 반복 횟수 × ${-number * 100}%`, `100% − repeats × ${-number * 100}%`, `100% − 反復回数 × ${-number * 100}%`)
  return raw
}

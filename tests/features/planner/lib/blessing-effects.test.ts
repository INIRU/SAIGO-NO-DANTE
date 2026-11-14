import { describe, expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import { blessingEffectSegments } from '@/features/planner/lib/blessing-effects'

const tones = (effect: string, previous?: string[], index = 0) =>
  blessingEffectSegments(effect, previous, index).map(segment => `${segment.tone}:${segment.text}`)

describe('blessing effect emphasis', () => {
  it('colours only the terms the game marks', () => {
    expect(tones('시작 <k>코스트</k> +150')).toEqual(['normal:시작 ', 'term:코스트', 'normal: +150'])
    // The game leaves "테마팩" plain in this line, so it is not guessed from a word list.
    expect(tones('기록 없는 테마팩 선택 시, 모든 <k>인격 레벨</k> +3 (최대 9)').filter(t => t.startsWith('term'))).toEqual(['term:인격 레벨'])
  })

  it('marks the values that changed from the level below', () => {
    expect(tones('시작 <k>코스트</k> +250', ['시작 <k>코스트</k> +150'])).toEqual(['normal:시작 ', 'term:코스트', 'normal: ', 'diff:+250'])
    expect(tones('<k>테마팩</k> 목록 +1', ['<k>테마팩</k> 목록 +1'])).toEqual(['term:테마팩', 'normal: 목록 +1'])
    expect(tones('전투 보상 카드에서 별빛 선택 시, 코스트 +75', ['a', 'b'], 2)).toEqual(['normal:전투 보상 카드에서 별빛 선택 시, 코스트 ', 'diff:+75'])
  })

  it('every blessing text carries the game marks and never shows them', () => {
    for (const messages of [ko, en, ja]) {
      const blessings = messages.planner.blessingTab.blessings as Record<string, { effectsByLevel: string[][] }>
      for (const effects of Object.values(blessings).flatMap(b => b.effectsByLevel)) {
        effects.forEach((effect, index) => {
          expect(effect.match(/<k>/g)?.length ?? 0).toBe(effect.match(/<\/k>/g)?.length ?? 0)
          expect(blessingEffectSegments(effect, effects, index).map(s => s.text).join('')).toBe(effect.replace(/<\/?k>/g, ''))
        })
      }
    }
    expect(ko.planner.blessingTab.blessings['100'].effectsByLevel[0][0]).toBe('시작 <k>코스트</k> +150')
    expect(en.planner.blessingTab.blessings['107'].effectsByLevel[0][1]).toBe('Gain 1 <k>Clash Power Up</k>')
    expect(ja.planner.blessingTab.blessings['107'].effectsByLevel[0][1]).toBe('<k>マッチ威力増加</k>1を得る')
  })
})

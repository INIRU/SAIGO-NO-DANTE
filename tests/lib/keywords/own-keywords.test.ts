import { describe, expect, it } from 'vitest'
import type { GameTextRefNames } from '@/lib/game-text/ref-names'
import { parseGameText, collectKeywordIds } from '@/lib/game-text/rich-text'
import { descriptionTexts, egoTexts, ownKeywordSet } from '@/lib/keywords/own-keywords'

const REFS: GameTextRefNames = {
  Vibration: { k: 'keyword', n: '진동', kw: '진동' },
  Sinking: { k: 'keyword', n: '침잠', kw: '침잠' },
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  CalcValue: { k: 'keyword', n: '계산값' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
}

describe('the keywords an identity or E.G.O owns', () => {
  it('collects [Id] and <link> keywords, once each', () => {
    const nodes = parseGameText('[Vibration] 3 <link="Sinking">침잠</link> [Vibration] <color=#ff0000>[Combustion]</color>')
    expect(collectKeywordIds(nodes)).toEqual(['Vibration', 'Sinking', 'Combustion'])
  })

  it('is the keyword list plus every keyword the own texts reference, not skill tags or keywords without a keyword_meta row', () => {
    const own = ownKeywordSet(['진동'], ['[OnSucceedAttack] [Sinking] 2', 'plain text without refs', '<link="Combustion">x</link> [CalcValue]'], REFS)
    expect([...own].sort()).toEqual(['진동', '침잠', '화상'])
  })

  it('is only the keyword list without the reference table, and empty without a list or texts', () => {
    expect([...ownKeywordSet(['진동', '침잠'], ['[Combustion]'], null)]).toEqual(['진동', '침잠'])
    expect(ownKeywordSet(null, [], REFS).size).toBe(0)
    expect(ownKeywordSet(undefined, [null, undefined, ''], REFS).size).toBe(0)
  })

  it('reads the texts of every skill and passive row, in every language that was sent', () => {
    expect(descriptionTexts([{ description: '가', description_en: 'a' }, { description_jp: 'あ' }], null, [{ description: null }])).toEqual(['가', 'a', 'あ'])
  })

  it('reads every effect of every E.G.O skill (normal and corroded), its stage passives and its passive', () => {
    const texts = egoTexts({
      ego_skills: [{ normalEffect: '본문', coin1Effect: '[Vibration]', coin1Effect_en: 'en coin', coin5Effect_jp: 'jp coin', name: '스킬' }],
      ego_cor_skills: [{ normalEffect_en: '부식', coin2Effect: '' }],
      stage_passives: [{ description: '단계 패시브', description_en: 'stage passive' }],
      passive_content: '패시브',
      passive_content_jp: '패시ブ',
    })
    expect(texts.sort()).toEqual(['본문', '[Vibration]', 'en coin', 'jp coin', '부식', '단계 패시브', 'stage passive', '패시브', '패시ブ'].sort())
  })

  it('reads the coins past the fifth of an E.G.O skill, once', () => {
    const coins = ['1', '2', '3', '4', '5', '여섯째', '일곱째']
    const texts = egoTexts({ ego_skills: [{ coin1Effect: '1', coin5Effect: '5', coinEffects: coins, coinEffects_en: [...coins.slice(0, 5), 'sixth'] }] })
    expect(texts.sort()).toEqual(['1', '5', '여섯째', '일곱째', 'sixth'].sort())
  })
})

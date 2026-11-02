import { describe, expect, it } from 'vitest'
import { gameTextRefDescriptions, gameTextRefNames, type GameTextRefRow } from '@/lib/db/game-text-refs'
import { ALL_GAME_DATA_TAGS, CACHE_TAGS } from '@/lib/constants/cache-tags'

const rows: GameTextRefRow[] = [
  { id: 'Combustion', kind: 'keyword', name: '화상', name_en: 'Burn', name_jp: '火傷', description: '턴 종료 시', description_en: 'At Turn End', description_jp: null, keyword_name: '화상' },
  { id: 'CalcValue', kind: 'keyword', name: '계산값', name_en: null, name_jp: null, description: null, description_en: null, description_jp: null, keyword_name: null },
  { id: 'CantBreak', kind: 'skilltag', name: null, name_en: null, name_jp: '[破壊不可]', description: null, description_en: null, description_jp: null, keyword_name: null },
  { id: 'NoName', kind: 'keyword', name: '', name_en: null, name_jp: null, description: null, description_en: null, description_jp: null, keyword_name: null },
  { id: 'OnSucceedAttack', kind: 'skilltag', name: '[적중시]', name_en: '[On Hit]', name_jp: null, description: null, description_en: null, description_jp: null, keyword_name: null },
]

describe('REQ-SHARED-019 game text reference reads', () => {
  it('REQ-SHARED-019 maps each id to kind, localized name (Korean fallback) and keyword_meta name', () => {
    expect(gameTextRefNames(rows, 'en')).toEqual({
      Combustion: { k: 'keyword', n: 'Burn', kw: '화상' },
      CalcValue: { k: 'keyword', n: '계산값' },
      CantBreak: { k: 'skilltag', n: '[破壊不可]' },
      NoName: { k: 'keyword', n: 'NoName' },
      OnSucceedAttack: { k: 'skilltag', n: '[On Hit]' },
    })
    expect(gameTextRefNames(rows, 'ja').OnSucceedAttack.n).toBe('[적중시]')
    expect(gameTextRefNames(rows, 'ko').Combustion.n).toBe('화상')
  })

  it('REQ-KEYWORDS-011 hands an id its own icon file as stored, and no icon key when the row has none', () => {
    const names = gameTextRefNames([{ ...rows[0], id: 'FullReload', icon_slug: 'game-FullReload' }, { ...rows[0], id: 'Empty', icon_slug: null }, rows[0]], 'ko')
    expect(names.FullReload.i).toBe('game-FullReload')
    expect(names.Empty).not.toHaveProperty('i')
    expect(names.Combustion).not.toHaveProperty('i')
  })

  it('REQ-SHARED-019 falls back to another language before the id when the name is missing (ko, en, jp order)', () => {
    for (const lang of ['ko', 'en', 'ja'] as const) {
      expect(gameTextRefNames(rows, lang).CantBreak.n).toBe('[破壊不可]')
      expect(gameTextRefNames(rows, lang).NoName.n).toBe('NoName')
    }
    const both: GameTextRefRow = { ...rows[0], id: 'Both', name: null, name_en: 'English', name_jp: '日本語' }
    expect(gameTextRefNames([both], 'ko').Both.n).toBe('English')
    expect(gameTextRefNames([both], 'en').Both.n).toBe('English')
    expect(gameTextRefNames([both], 'ja').Both.n).toBe('日本語')
    expect(gameTextRefNames([{ ...both, name_en: null }], 'en').Both.n).toBe('日本語')
  })

  it('REQ-SHARED-019 maps keywords with a description to it, falling back to Korean, and skips skill tags', () => {
    expect(gameTextRefDescriptions(rows, 'en')).toEqual({ Combustion: 'At Turn End' })
    expect(gameTextRefDescriptions(rows, 'ja')).toEqual({ Combustion: '턴 종료 시' })
  })

  it('REQ-SHARED-019 is invalidated with the other game data', () => {
    expect(ALL_GAME_DATA_TAGS).toContain(CACHE_TAGS.gameTextRefs)
  })
})

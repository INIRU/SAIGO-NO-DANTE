import { describe, expect, it } from 'vitest'
import { buildKeywordPool } from '@/components/notes/NoteAutocomplete'
import { getKeywordIconUrl } from '@/lib/constants/keywords'
import { getGameUiAsset } from '@/lib/utils/game-ui'

describe('note keyword artwork', () => {
  it('uses the same verified alias and atlas URLs as the catalogue', () => {
    const pool = buildKeywordPool({
      '지령': { desc: '장치', iconSlug: 'prescript-device-iv' },
      '진동 폭발': { desc: '폭발', iconSlug: 'tremor-burst' },
    })
    expect(pool.map(suggestion => suggestion.iconUrl)).toEqual([
      getKeywordIconUrl('Prescript', 'prescript-2'), getGameUiAsset('keywords/tremor-burst'),
    ])
    expect(pool.map(suggestion => suggestion.token)).toEqual(['[k:지령]', '[k:진동 폭발]'])
  })
})

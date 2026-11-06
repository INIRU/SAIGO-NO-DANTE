import { describe, expect, it } from 'vitest'
import { searchIdentityRows } from '@/features/meta/lib/identity-search'
import type { IdentityStat } from '@/lib/meta/types'

const row = (identity_id: string, sinner_id: string, name_kr: string, name_en: string, name_jp: string, keywords: string[] = []): IdentityStat =>
  ({ identity_id, sinner_id, name_kr, name_en, name_jp, keywords, rarity: 3, folder_name: null, game_id: null, count: 1 })

const ROWS = [
  row('a', 'ryoshu', '검계 살수', 'Kurokumo Clan Wakashu', '黒雲会 若衆', ['출혈']),
  row('b', 'rodion', 'LCB 수감자', 'LCB Sinner', 'LCB囚人'),
  row('c', 'yi-sang', '검은 침묵 사무소 해결사', 'Black Silence Fixer', '黒い沈黙事務所フィクサー', ['화상']),
  row('d', 'ryoshu', '7협회 남부 6과 부장', 'Seven Assoc. South Section 6 Director', 'セブン協会南部6課部長', ['파열']),
]
const KEYWORDS = { 화상: { nameEn: 'Burn', nameJp: '火傷' }, 출혈: { nameEn: 'Bleed', nameJp: '出血' } }
const ids = (query: string) => searchIdentityRows(ROWS, query, KEYWORDS).map(r => r.identity_id)

describe('searchIdentityRows (the site search engine over the analysis identities)', () => {
  it('keeps the given order when the query is empty', () => {
    expect(ids('')).toEqual(['a', 'b', 'c', 'd'])
    expect(ids('   ')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('finds an identity by its name in another language', () => {
    expect(ids('Kurokumo')).toEqual(['a'])
    expect(ids('若衆')).toEqual(['a'])
  })

  it('finds a sinner\'s identities by the sinner\'s name in any language or an alias', () => {
    expect(ids('Ryōshū').sort()).toEqual(['a', 'd'])
    expect(ids('Rodya')).toEqual(['b'])
  })

  it('finds identities by keyword in any language', () => {
    expect(ids('화상')).toEqual(['c'])
    expect(ids('Bleed')).toEqual(['a'])
  })

  it('matches Korean initial consonants, words split by spaces and one typo', () => {
    expect(ids('ㄱㄱ ㅅㅅ')).toContain('a')
    expect(ids('료슈 부장')).toEqual(['d'])
    expect(ids('Kurokmo')).toEqual(['a'])
  })
})

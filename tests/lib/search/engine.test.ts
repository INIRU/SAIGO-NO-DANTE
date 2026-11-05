import { describe, expect, it } from 'vitest'
import { expandIndex, fold, search, type IndexEntry } from '@/lib/search/engine'

const ryoshuCtx = [{ field: 'sinner' as const, text: '료슈' }, { field: 'sinner' as const, text: 'Ryōshū' }, { field: 'sinner' as const, text: '良秀' }]
const rodionCtx = [{ field: 'sinner' as const, text: '로쟈' }, { field: 'sinner' as const, text: 'Rodion' }, { field: 'alias' as const, text: 'Rodya' }]

const entries: IndexEntry[] = [
  { type: 'sinner', href: '/sinners/ryoshu', label: '료슈', names: { ko: '료슈', en: 'Ryōshū', ja: '良秀' } },
  { type: 'sinner', href: '/sinners/rodion', label: '로쟈', names: { ko: '로쟈', en: 'Rodion', ja: 'ロージャ' }, context: [{ field: 'alias', text: 'Rodya' }] },
  { type: 'identity', href: '/i/1', label: 'LCB 수감자', names: { ko: 'LCB 수감자', en: 'LCB Sinner', ja: 'LCB囚人' }, context: ryoshuCtx },
  { type: 'identity', href: '/i/2', label: '검계 살수', names: { ko: '검계 살수', en: 'Kurokumo Clan Wakashu', ja: '黒雲会 若衆' }, context: ryoshuCtx },
  { type: 'identity', href: '/i/3', label: 'LCB 수감자', names: { ko: 'LCB 수감자', en: 'LCB Sinner', ja: 'LCB囚人' }, context: rodionCtx },
  { type: 'ego', href: '/e/1', label: '적안', names: { ko: '적안', en: 'Red Eyes', ja: '赤眼' }, context: ryoshuCtx },
  { type: 'keyword', href: '/k/burn', label: '화상', names: { ko: '화상', en: 'Burn', ja: '火傷' } },
  { type: 'keyword', href: '/k/long', label: '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…', names: { ko: '레이피어로 몸에 10개 이상의 구멍을 내야할 때는…' } },
  { type: 'egoGift', href: '/g/1', label: '불꽃 깃털', names: { ko: '불꽃 깃털' }, context: [{ field: 'keyword', text: '화상' }, { field: 'keyword', text: 'Burn' }] },
  { type: 'sinner', href: '/sinners/yi-sang', label: '이상', names: { ko: '이상', en: 'Yi Sang', ja: 'イサン' } },
  { type: 'sinner', href: '/sinners/meursault', label: '뫼르소', names: { ko: '뫼르소', en: 'Meursault', ja: 'ムルソー' } },
  { type: 'page', href: '/decks', label: '덱 게시판', names: { ko: '덱 게시판', en: 'Deck Board', ja: 'デッキ掲示板' }, context: [{ field: 'alias', text: '편성' }] },
]

const hrefs = (q: string) => search(entries, q).map(h => h.entry.href)

describe('fold', () => {
  it('drops separators, case, width and latin diacritics, and maps back to the original', () => {
    const f = fold('Ryōshū LCB')
    expect(f.text).toBe('ryoshulcb')
    expect(f.map[6]).toBe(7)
  })
  it('folds katakana to hiragana', () => {
    expect(fold('ロージャ').text).toBe(fold('ろーじゃ').text)
  })
})

describe('search ranking (REQ-SHARED-050, REQ-SHARED-008)', () => {
  it('a sinner name finds that sinner first, then their identities and E.G.O through the sinner context', () => {
    const r = hrefs('료슈')
    expect(r[0]).toBe('/sinners/ryoshu')
    expect(r).toEqual(expect.arrayContaining(['/i/1', '/i/2', '/e/1']))
    expect(r).not.toContain('/i/3')
  })
  it('ignores latin diacritics and finds aliases', () => {
    expect(hrefs('ryoshu')[0]).toBe('/sinners/ryoshu')
    expect(hrefs('rodya')[0]).toBe('/sinners/rodion')
    expect(hrefs('rodya')).toContain('/i/3')
  })
  it('exact > prefix > word start > contains, shorter names first', () => {
    expect(hrefs('이상')[0]).toBe('/sinners/yi-sang')
    expect(hrefs('이상').indexOf('/k/long')).toBeGreaterThan(0)
    expect(hrefs('수감자')).toEqual(expect.arrayContaining(['/i/1', '/i/3']))
  })
  it('does not match 초성-only or one-letter queries in the middle of a name', () => {
    expect(hrefs('ㄹㅅ')).toContain('/sinners/ryoshu')
    expect(hrefs('ㄹㅅ')).not.toContain('/k/long')
    expect(hrefs('l')).not.toContain('/sinners/meursault')
  })
  it('multi-word queries match across name and context', () => {
    const r = hrefs('료슈 LCB')
    expect(r[0]).toBe('/i/1')
    expect(r).not.toContain('/i/3')
  })
  it('gift keywords are context: the keyword itself ranks above its gifts', () => {
    const r = hrefs('화상')
    expect(r[0]).toBe('/k/burn')
    expect(r).toContain('/g/1')
  })
  it('falls back to similar names only when nothing matches', () => {
    expect(hrefs('검살')).toContain('/i/2')
    expect(hrefs('meursalt')).toContain('/sinners/meursault')
    expect(search(entries, '검살').every(h => h.reasons[0].field === 'fuzzy')).toBe(true)
  })
  it('pages are searchable by name and alias', () => {
    expect(hrefs('덱')[0]).toBe('/decks')
    expect(hrefs('편성')).toContain('/decks')
  })
})

describe('search reasons (REQ-SHARED-051)', () => {
  it('marks the matched letters of the shown label', () => {
    const hit = search(entries, 'lcb수감')[0]
    expect(hit.reasons[0]).toEqual({ field: 'label', text: 'LCB 수감자', ranges: [[0, 6]] })
  })
  it('names the field when the label itself did not match', () => {
    const hit = search(entries, 'red eye').find(h => h.entry.href === '/e/1')!
    expect(hit.reasons[0]).toEqual({ field: 'en', text: 'Red Eyes', ranges: [[0, 7]] })
    const ctx = search(entries, '료슈').find(h => h.entry.href === '/i/2')!
    expect(ctx.reasons[0]).toEqual({ field: 'sinner', text: '료슈', ranges: [[0, 2]] })
  })
  it('marks 초성 matches on the syllables they hit', () => {
    const hit = search(entries, 'ㅎㅅ').find(h => h.entry.href === '/k/burn')!
    expect(hit.reasons[0].ranges).toEqual([[0, 2]])
  })
  it('gives one reason per word for multi-word queries', () => {
    const hit = search(entries, '료슈 LCB')[0]
    expect(hit.reasons.map(r => r.field).sort()).toEqual(['label', 'sinner'])
  })
})

describe('expandIndex', () => {
  it('gives identities their sinner names and aliases as context and completes storage paths', () => {
    const [, identity] = expandIndex([
      { type: 'sinner', href: '/sinners/rodion', label: '로쟈', names: { ko: '로쟈', en: 'Rodion', ja: 'ロージャ' }, context: [{ field: 'alias', text: 'Rodya' }] },
      { type: 'identity', href: '/i/3', label: 'LCB 수감자', names: { ko: 'LCB 수감자' }, sinner: 'rodion', icon: 'identities/a.webp' },
    ], 'https://cdn')
    expect(identity.context).toEqual(['로쟈', 'Rodion', 'ロージャ', 'Rodya'].map(text => ({ field: 'sinner', text })))
    expect(identity.icon).toBe('https://cdn/identities/a.webp')
  })
})

import { describe, expect, it } from 'vitest'
import {
  IDENTITY_FILTER_SELECT_LEGACY, IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS, QUERY_OPTIONS,
  parseCsvParam, serializeCsvParam, toDeckFilterIdentity, type IdentityNameEntry,
} from '@/features/decks/lib/filter-params'

// The four copies the shared helpers replaced: DecksClient and CommunityClient (string in), the deck list filter and the planner API (string | null in).
const decksParse = (value: string) => {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}
const serverParse = (value: string | null) => {
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}
const decksSerialize = (values: Iterable<string>) => {
  const serialized = [...values].filter(Boolean).join(',')
  return serialized || null
}
const communitySerialize = (values: Set<string>) => [...values].join(',')

const QUERIES = ['', 'a', 'a,b', ' a , b ,, c ', ',', ' , ', '참격,관통', 'a,a,b', 'id-1, id-2']

describe('parseCsvParam', () => {
  it('reads a query value the way every list and the API read it', () => {
    for (const query of QUERIES) {
      expect(parseCsvParam(query), query).toEqual(decksParse(query))
      expect(parseCsvParam(query), query).toEqual(serverParse(query))
    }
  })

  it('reads a missing parameter as no values', () => {
    expect(parseCsvParam(null)).toEqual([])
    expect(parseCsvParam(undefined)).toEqual([])
  })

  it('trims each item and drops the empty ones', () => {
    expect(parseCsvParam(' a , b ,, c ')).toEqual(['a', 'b', 'c'])
    expect(parseCsvParam(' , ')).toEqual([])
  })
})

describe('serializeCsvParam', () => {
  it('writes what the deck list wrote, null when nothing is picked', () => {
    for (const query of QUERIES) {
      const picked = new Set(parseCsvParam(query))
      expect(serializeCsvParam(picked), query).toBe(decksSerialize(picked))
    }
    expect(serializeCsvParam(new Set())).toBeNull()
    expect(serializeCsvParam([])).toBeNull()
  })

  it('writes what the plan board wrote once its empty string became null', () => {
    for (const query of QUERIES) {
      const picked = new Set(parseCsvParam(query))
      expect(serializeCsvParam(picked), query).toBe(communitySerialize(picked) || null)
    }
  })

  it('keeps the order of the picks and takes a set or an array', () => {
    expect(serializeCsvParam(new Set(['b', 'a']))).toBe('b,a')
    expect(serializeCsvParam(['b', 'a'])).toBe('b,a')
  })

  it('reads back what it wrote', () => {
    const picked = ['참격', 'id-1', '관통']
    expect(parseCsvParam(serializeCsvParam(picked))).toEqual(picked)
  })
})

describe('QUERY_OPTIONS', () => {
  it('replaces the history entry, stays shallow and keeps the scroll position', () => {
    expect(QUERY_OPTIONS).toEqual({ history: 'replace', shallow: true, scroll: false })
  })
})

describe('identity filter selects', () => {
  it('the legacy select is the full one without the skill keyword column', () => {
    expect(IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS).toBe('id, sinner_id, name_kr, name_en, name_jp, rarity, release_date, keywords, skill_keyword_list, folder_name, game_id, hp, speed_min, speed_max, def_level, sinner:sinners(id, name_kr, order_num)')
    expect(IDENTITY_FILTER_SELECT_LEGACY).toBe(IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS.replace('skill_keyword_list, ', ''))
    expect(IDENTITY_FILTER_SELECT_LEGACY).not.toContain('skill_keyword_list')
  })
})

describe('toDeckFilterIdentity', () => {
  const entry: IdentityNameEntry = {
    id: 'i1', name: '', name_kr: '이름', name_en: 'Name', name_jp: null, sinner_id: 's1', folder_name: 'f', game_id: '10101', rarity: 3,
    release_date: '2024-01-01', keywords: ['참격'], skill_keyword_list: ['관통'], hp: 100, speed_min: 3, speed_max: 6, def_level: 40,
    sinner: [{ id: 's1', name_kr: '이상', order_num: 1 }],
  }

  it('maps a row to the picker identity: Korean name, first sinner, zero for missing numbers', () => {
    expect(toDeckFilterIdentity(entry)).toEqual({
      id: 'i1', sinner_id: 's1', name: '이름', name_kr: '이름', name_en: 'Name', name_jp: null, rarity: 3, release_date: '2024-01-01',
      keywords: ['참격'], skill_keyword_list: ['관통'], folder_name: 'f', game_id: '10101', hp: 100, speed_min: 3, speed_max: 6, def_level: 40,
      tier: 0, sinner: { id: 's1', name_kr: '이상', order_num: 1 },
    })
    const bare = toDeckFilterIdentity({ ...entry, release_date: null, keywords: null, skill_keyword_list: undefined, hp: null, speed_min: null, speed_max: null, def_level: null, sinner: null })
    expect(bare).toMatchObject({ release_date: undefined, keywords: [], skill_keyword_list: [], hp: 0, speed_min: 0, speed_max: 0, def_level: 0, sinner: null })
  })

  it('takes a single sinner object as it is', () => {
    expect(toDeckFilterIdentity({ ...entry, sinner: { id: 's2', name_kr: '파우스트', order_num: 2 } }).sinner).toEqual({ id: 's2', name_kr: '파우스트', order_num: 2 })
  })

  it('without the column the deck list leaves the skill keywords empty, the plan board falls back to the keywords', () => {
    const old = { ...entry, skill_keyword_list: undefined }
    expect(toDeckFilterIdentity(old).skill_keyword_list).toEqual([])
    expect(toDeckFilterIdentity(old, { fallbackToKeywords: true }).skill_keyword_list).toEqual(['참격'])
    expect(toDeckFilterIdentity({ ...old, keywords: null }, { fallbackToKeywords: true }).skill_keyword_list).toEqual([])
  })

  it('a present column wins in both', () => {
    expect(toDeckFilterIdentity(entry, { fallbackToKeywords: true }).skill_keyword_list).toEqual(['관통'])
    expect(toDeckFilterIdentity({ ...entry, skill_keyword_list: [] }, { fallbackToKeywords: true }).skill_keyword_list).toEqual([])
  })
})

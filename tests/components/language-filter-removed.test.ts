import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('the deck and plan lists have no language filter', () => {
  it('REQ-DECKS-052 the deck list has no language control, address value or request value', () => {
    for (const path of ['app/[lang]/decks/DecksClient.tsx', 'components/decks/DeckListFilters.tsx', 'components/decks/decks-types.ts']) {
      expect(read(path), path).not.toMatch(/languageFilter|LanguageFilter|DeckLanguage|useQueryState\('lang'|set\('lang'/)
    }
  })

  it('REQ-PLANNER-046 the plan community list has no language control, address value or request value', () => {
    expect(read('app/[lang]/planner/community/CommunityClient.tsx')).not.toMatch(/languageFilter|LanguageFilter|DeckLanguage|useQueryState\('lang'|set\('lang'/)
  })

  it('REQ-DECKS-052 REQ-PLANNER-046 the language filter texts are gone in ko, en and ja', () => {
    for (const lang of ['ko', 'en', 'ja']) expect(read(`messages/${lang}.json`), lang).not.toContain('"languageFilter"')
  })
})

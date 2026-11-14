import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')

describe('the deck and plan lists have no language filter', () => {
  it('the deck list has no language control, address value or request value', () => {
    for (const path of ['app/[lang]/decks/DecksClient.tsx', 'features/decks/components/DeckListFilters.tsx', 'lib/decks/decks-types.ts']) {
      expect(read(path), path).not.toMatch(/languageFilter|LanguageFilter|DeckLanguage|useQueryState\('lang'|set\('lang'/)
    }
  })

  it('the plan community list has no language control, address value or request value', () => {
    expect(read('app/[lang]/planner/community/CommunityClient.tsx')).not.toMatch(/languageFilter|LanguageFilter|DeckLanguage|useQueryState\('lang'|set\('lang'/)
  })

  it('the language filter texts are gone in ko, en and ja', () => {
    for (const lang of ['ko', 'en', 'ja']) expect(read(`messages/${lang}.json`), lang).not.toContain('"languageFilter"')
  })
})

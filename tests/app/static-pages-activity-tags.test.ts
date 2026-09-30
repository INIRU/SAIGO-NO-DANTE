import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// A static page that reads data tagged decksList/plansList is regenerated (and its whole HTML, RSC and segments are
// written to the ISR cache again) after every vote, comment and post. These pages load that data in the browser.
const STATIC_PAGES = [
  'app/[lang]/(home)/page.tsx',
  'components/home/HomeStaticSections.tsx',
  'app/[lang]/decks/page.tsx',
  'app/[lang]/planner/community/page.tsx',
]

it('keeps community data out of the static home and board pages', () => {
  const offenders = STATIC_PAGES.filter(file => /CACHE_TAGS\.(decksList|plansList)|loadDiscovery\(|cacheLife\(['"]minutes['"]\)/.test(readFileSync(file, 'utf8')))
  expect(offenders).toEqual([])
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8')
// the text of the first `await Promise.all([` … `])` that contains `marker`
const promiseAllAround = (source: string, marker: string) => {
  const at = source.indexOf(marker)
  const start = source.lastIndexOf('await Promise.all([', at)
  const end = source.slice(at).search(/\n\s*\]\)/)
  return start < 0 || end < 0 ? '' : source.slice(start, at + end)
}

describe('server pages fetch independent data together', () => {
  it('a deck detail reads its series, recommendations, E.G.O skills and author together once the deck is in', () => {
    const page = read('app/[lang]/decks/[id]/page.tsx')
    const all = promiseAllAround(page, 'fetchDeckRecommendations(supabase, lang')
    for (const call of ['loadSeriesOfPost(', 'fetchDeckRecommendations(', 'fetchEgoAttackSkillsByEgoId(', 'withPostAuthors(']) {
      expect(all, call).toContain(call)
    }
    // a series that fails to load still leaves the deck shown
    expect(all).toMatch(/loadSeriesOfPost\([^)]*\)\.catch\(\(\) => null\)/)
  })

  it('a deck editor reads the deck and the builder data while it checks the sign-in', () => {
    const page = read('app/[lang]/decks/[id]/edit/page.tsx')
    const all = promiseAllAround(page, 'checkSignIn(),')
    for (const call of ['checkSignIn()', 'loadDeck()', 'fetchDeckBuilderData(lang)']) expect(all, call).toContain(call)
    // nothing awaits the sign-in before that
    expect(page.slice(0, page.indexOf('await Promise.all([\n    checkSignIn()'))).not.toMatch(/^  const session = await/m)
  })
})

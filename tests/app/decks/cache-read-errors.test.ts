import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const page = readFileSync(join(process.cwd(), 'app/[lang]/decks/[id]/page.tsx'), 'utf8')
const comments = readFileSync(join(process.cwd(), 'features/decks/components/DeckComments.tsx'), 'utf8')

function fn(source: string, header: string) {
  const start = source.indexOf(header)
  expect(start, header).toBeGreaterThan(-1)
  const next = source.indexOf('\nexport ', start)
  return source.slice(start, next === -1 ? undefined : next)
}

describe('REQ-SHARED-099 a failed deck read is not cached as an empty page', () => {
  const cached = fn(page, 'async function getCachedDeckDetailPayload')

  it('REQ-SHARED-099 the cached payload throws on a deck or comment read error', () => {
    expect(cached).toMatch(/if \(deckResult\.error\) throw deckResult\.error/)
    expect(cached).toMatch(/if \(commentsResult\.error\) throw commentsResult\.error/)
  })

  it('REQ-SHARED-099 the cached payload does not swallow errors itself', () => {
    expect(cached).not.toMatch(/\} catch \(error\)/)
  })

  it('REQ-SHARED-099 the caller catches outside the cache, reports to Sentry and falls back to the client fetch', () => {
    const runtime = fn(page, 'async function DeckDetailRuntime')
    expect(runtime).toMatch(/await getCachedDeckDetailPayload\(lang, id\)\.catch\(\(error\) => \{[\s\S]*Sentry\.captureException[\s\S]*return EMPTY_PAYLOAD/)
    expect(page).toMatch(/const EMPTY_PAYLOAD = \{\s*initialDeck: null/)
  })
})

describe('REQ-SHARED-099 the comment list effect depends on the deck id', () => {
  it('REQ-SHARED-099 DeckComments does not list the whole initialComments array as a dependency', () => {
    expect(comments).not.toMatch(/\}, \[[^\]]*initialComments[^\]]*\]\)/)
  })
})

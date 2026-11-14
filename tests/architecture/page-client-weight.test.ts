import { describe, expect, it } from 'vitest'
import { clientGraph } from './client-graph'

// The four heaviest screens (decision 0003 plan 3, task 6): what only a click, a note block or a closed picker uses loads later.
const PAGES = [
  'app/[lang]/planner/page.tsx',
  'app/[lang]/planner/community/[id]/page.tsx',
  'app/[lang]/decks/page.tsx',
  'app/[lang]/decks/[id]/page.tsx',
]
// pretext measures E.G.O names after the card mounts; zod only checks series requests on the server; pako only runs when a
// formation code is copied or applied
const LATER = /^(@chenglou\/pretext|zod|pako)(\/|$)/

describe('page client weight', () => {
  it.each(PAGES)('%s keeps pretext, zod and pako out of its first load', page => {
    const { packages } = clientGraph(page)
    const offenders = [...packages].filter(([name]) => LATER.test(name))
    expect(offenders, offenders.map(([name, from]) => `${name} ← ${from}`).join('\n')).toEqual([])
    expect(packages.size, 'the walk reaches the page\'s client code').toBeGreaterThan(5)
  })
})

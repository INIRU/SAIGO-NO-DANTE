import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(process.cwd(), 'app/[lang]/decks/DecksClient.tsx'), 'utf8')

/** The `fetch('/api/decks?…')` chain that starts at the n-th call, up to its `.finally`. */
function chain(n: number) {
  let at = -1
  for (let i = 0; i <= n; i++) at = source.indexOf('fetch(`/api/decks?', at + 1)
  expect(at, `fetch #${n}`).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf('.finally', at))
}

describe('a failed deck list request is reported', () => {
  it('the first page request rejects a non-ok response and shows an error', () => {
    const first = chain(0)
    expect(first).toMatch(/!r\.ok\) throw/)
    expect(first).toMatch(/showError\(/)
  })

  it('load more rejects a non-ok response, shows an error and keeps hasMore', () => {
    const more = chain(1)
    expect(more).toMatch(/!r\.ok\) throw/)
    expect(more).toMatch(/showError\(/)
    // the catch must not end the list: only an empty or short page does that
    expect(more.slice(more.indexOf('.catch'))).not.toMatch(/setHasMore\(false\)/)
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const queries = readFileSync(resolve(__dirname, '../../../lib/db/queries.ts'), 'utf8')
const body = (name: string) => queries.slice(queries.indexOf(`export async function ${name}`), queries.indexOf('\n}\n', queries.indexOf(`export async function ${name}`)))

describe('the identity and E.G.O browsers list the newest release first', () => {
  it('both queries order by release date, newest first, then game id', () => {
    for (const name of ['getAllIdentitiesForBrowser', 'getAllEGOsForBrowser']) {
      const fn = body(name)
      expect(fn, name).toMatch(/\.order\('release_date', \{ ascending: false, nullsFirst: false \}\)\s*\.order\('game_id', \{ ascending: false \}\)/)
      expect(fn, name).not.toMatch(/\.order\('(rarity|grade|name_kr)'/)
    }
  })

  it('the default sort is named for what it does in every language', () => {
    expect([ko, en, ja].map(m => m.browser.sort.default)).toEqual(['최신순', 'Newest', '新しい順'])
  })
})

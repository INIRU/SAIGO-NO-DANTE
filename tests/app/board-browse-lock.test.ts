import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('keeps the board scroll lock out of CSS :has(), which leaks onto the next route', () => {
  // Cache Components keeps the hidden board mounted after navigation, so html:has() would still match it.
  expect(readFileSync('app/globals.css', 'utf8')).not.toMatch(/(html|body):has\(\[data-board-browse\]\)/)
})

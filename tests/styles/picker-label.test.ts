import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

it('keeps the picker label rules (two-line clamp, overflow hidden) off the identity card, whose root is a span', () => {
  // The card's sinner badge sits past the frame corner; a label rule on `.note-picker-item>span` clipped it.
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }))
  const offending = rules.filter(({ selector, body }) => /\.note-picker-item>span(?![\w-])/.test(selector) && /overflow|line-clamp|padding|margin/.test(body))
  expect(offending.map(({ selector }) => selector)).toEqual([])
})

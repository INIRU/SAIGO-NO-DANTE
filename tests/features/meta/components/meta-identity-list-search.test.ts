import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'styles/components/MetaAnalysis.module.css'), 'utf8')

describe('identity list search stays usable', () => {
  it('styles only the list rows as full-width buttons, never the search clear button', () => {
    // `.identityList button` also matched the clear (X) button of the search: once text was typed it took the full
    // width and the input shrank to 0px, so the typed name was invisible.
    expect(css).not.toMatch(/\.identityList button[\s,:[{]/)
    expect(css).toMatch(/\.identityList li > button \{[^}]*width: 100%/)
  })
})

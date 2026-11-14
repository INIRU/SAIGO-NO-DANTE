import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const builder = read('app/[lang]/decks/new/DeckBuilderClient.tsx')
// the detail page's copy and share buttons live in the hook the page calls
const detail = read('features/decks/hooks/useDeckDetailActions.ts')

/** Body of a `const name = ...` arrow function up to the next top-level handler. */
function handler(source: string, name: string) {
  const start = source.indexOf(`const ${name} = `)
  expect(start, `${name} exists`).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('\n\n', start))
}

describe('editing a deck keeps its tags', () => {
  it('handleSave sends the edit mode tags instead of an empty list', () => {
    const save = handler(builder, 'handleSave')
    expect(save).toMatch(/tags: editMode\?\.tags \?\? \[\]/)
    expect(save).not.toMatch(/tags: \[\]/)
  })
})

describe('a failed save or copy is reported and can be retried', () => {
  it('handleSave catches a rejected fetch with showError and always clears saving', () => {
    const save = handler(builder, 'handleSave')
    expect(save).toMatch(/try \{[\s\S]*await fetch\(/)
    expect(save).toMatch(/\} catch[\s\S]*showError\(/)
    expect(save).toMatch(/\} finally \{\s*setSaving\(false\)/)
  })

  it('the builder code copy reports a clipboard failure', () => {
    const copy = handler(builder, 'handleCopyCode')
    expect(copy).toMatch(/try \{[\s\S]*clipboard\.writeText[\s\S]*\} catch[\s\S]*showError\(/)
  })

  it('the detail page code copy and share report a clipboard failure', () => {
    const copy = handler(detail, 'handleCopyCode')
    expect(copy).toMatch(/try \{[\s\S]*clipboard\.writeText[\s\S]*\} catch[\s\S]*showError\(/)
    const share = handler(detail, 'handleShare')
    expect(share).toMatch(/\} catch[\s\S]*showError\(/)
    expect(share).toMatch(/\} finally \{\s*setShareGenerating\(false\)/)
  })
})

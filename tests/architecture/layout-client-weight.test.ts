import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clientGraph } from './client-graph'

const root = resolve(__dirname, '../..')
const layoutClient = () => clientGraph('app/[lang]/layout.tsx')

describe('layout client weight', () => {
  it('keeps validation, database clients and the translation table out of the code every page downloads', () => {
    const { packages, files } = layoutClient()
    const offenders = [...packages].filter(([name]) => /^(zod|@supabase\/supabase-js)(\/|$)/.test(name))
    expect(offenders, offenders.map(([name, from]) => `${name} ← ${from}`).join('\n')).toEqual([])
    // the whole three-language translation table (the layout passes each page only its own messages)
    expect(files.has('lib/i18n/translations.ts')).toBe(false)
    // the walk reaches the layout's client code at all
    expect(packages.has('motion/react')).toBe(true)
  })

  it('loads the animation features after the page, so the motion engine is not in every first load', () => {
    const provider = readFileSync(resolve(root, 'components/ui/MotionProvider.tsx'), 'utf8')
    expect(provider).not.toMatch(/import\s*\{[^}]*\bdomAnimation\b[^}]*\}\s*from/)
    expect(provider).toMatch(/features=\{loadFeatures\}/)
  })
})

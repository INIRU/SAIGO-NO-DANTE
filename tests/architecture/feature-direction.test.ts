import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findFeatureCycles } from './imports'

const cycles = (files: Record<string, string>) => findFeatureCycles(Object.entries(files).map(([path, source]) => ({ path, source })))

describe('feature dependency direction', () => {
  it('flags two features that import each other', () => {
    const out = cycles({ 'features/decks/a.ts': "import { x } from '@/features/notes'", 'features/notes/index.ts': "export { y } from '@/features/decks/lib/y'", 'features/decks/lib/y.ts': 'export const y = 1' })
    expect(out).toMatchObject([{ features: ['decks', 'notes'] }])
    expect(out[0].via).toEqual(['decks>notes: features/decks/a.ts -> features/notes/index.ts', 'notes>decks: features/notes/index.ts -> features/decks/lib/y.ts'])
  })

  it('flags a loop through a third feature', () => {
    const out = cycles({ 'features/a/x.ts': "import '@/features/b/x'", 'features/b/x.ts': "import '@/features/c/x'", 'features/c/x.ts': "import '@/features/a/x'" })
    expect(out).toMatchObject([{ features: ['a', 'b', 'c'] }])
  })

  it('allows one direction, any number of files and a feature using its own files', () => {
    const files = { 'features/a/x.ts': "import './y'\nimport '@/features/b/x'", 'features/a/y.ts': "import '@/features/b/y'", 'features/b/x.ts': '', 'features/b/y.ts': '' }
    expect(cycles(files)).toEqual([])
  })

  it('does not count shared folders or the app between two features', () => {
    const files = { 'features/a/x.ts': "import '@/lib/s'", 'lib/s.ts': "import '@/features/b/x'", 'features/b/x.ts': "import '@/lib/s'" }
    expect(cycles(files)).toEqual([])
  })

  it('the repository has features that depend on each other in one direction only', () => {
    const tracked = execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'hooks', 'features'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const files = tracked
      .split('\n')
      .filter((p) => /\.tsx?$/.test(p) && existsSync(p))
      .map((p) => ({ path: p, source: readFileSync(p, 'utf8') }))
    expect(files.length).toBeGreaterThan(0)
    expect(findFeatureCycles(files)).toEqual([])
  })
})

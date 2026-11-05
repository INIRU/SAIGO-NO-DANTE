import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findImportViolations } from './imports'

const check = (path: string, source: string) => findImportViolations([{ path, source }])

describe('REQ-SHARED-074 feature boundaries', () => {
  it('REQ-SHARED-074 flags a deep import of another feature', () => {
    const out = check('app/[lang]/decks/page.tsx', "import { A } from '@/features/decks/components/A'")
    expect(out).toMatchObject([{ rule: 'feature-internal' }])
  })

  it('REQ-SHARED-074 allows the feature entry and its own internals', () => {
    expect(check('app/[lang]/decks/page.tsx', "import { A } from '@/features/decks'")).toEqual([])
    expect(check('features/decks/components/A.tsx', "import { x } from '../lib/x'")).toEqual([])
    expect(check('features/decks/components/A.tsx', "import { x } from '@/features/decks/lib/x'")).toEqual([])
  })

  it('REQ-SHARED-074 flags shared code that imports a feature', () => {
    const out = check('components/ui/Button.tsx', "export * from '@/features/notes'")
    expect(out).toMatchObject([{ rule: 'shared-imports-feature' }])
  })

  it('REQ-SHARED-074 reads type imports, re-exports and dynamic imports', () => {
    const source = [
      "import type { T } from '@/features/decks/types'",
      "export { x } from '@/features/notes/lib/x'",
      "const m = await import('@/features/planner/lib/y')",
      "import { z } from '../../features/shop/components/Z'",
    ].join('\n')
    const out = check('app/[lang]/page.tsx', source)
    expect(out.map((v) => v.rule)).toEqual(Array(4).fill('feature-internal'))
  })

  it('REQ-SHARED-074 flags another feature reaching into a feature', () => {
    const out = check('features/decks/lib/a.ts', "import { x } from '@/features/notes/lib/x'")
    expect(out).toMatchObject([{ rule: 'feature-internal' }])
  })

  it('REQ-SHARED-074 leaves tests and e2e alone', () => {
    expect(check('tests/features/decks/a.test.ts', "import { A } from '@/features/decks/components/A'")).toEqual([])
    expect(check('e2e/a.spec.ts', "import { A } from '@/features/decks/components/A'")).toEqual([])
  })

  it('REQ-SHARED-074 the repository has no violations', () => {
    const tracked = execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'hooks', 'features'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const files = tracked
      .split('\n')
      .filter((p) => /\.tsx?$/.test(p) && existsSync(p))
      .map((p) => ({ path: p, source: readFileSync(p, 'utf8') }))
    expect(findImportViolations(files)).toEqual([])
  })
})

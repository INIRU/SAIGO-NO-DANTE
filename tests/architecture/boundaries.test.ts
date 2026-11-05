import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findImportViolations } from './imports'

const check = (path: string, source: string) => findImportViolations([{ path, source }])

describe('REQ-SHARED-074 feature boundaries', () => {
  it('REQ-SHARED-074 flags a deep import of another feature', () => {
    const out = check('app/[lang]/decks/page.tsx', "import { A } from '@/features/decks/lib/a'")
    expect(out).toMatchObject([{ rule: 'feature-internal' }])
  })

  it('REQ-SHARED-074 allows one component or hook file by path, nothing deeper', () => {
    expect(check('app/[lang]/decks/page.tsx', "import A from '@/features/decks/components/A'")).toEqual([])
    expect(check('app/[lang]/decks/page.tsx', "import { useA } from '@/features/decks/hooks/useA'")).toEqual([])
    expect(check('app/[lang]/decks/page.tsx', "import s from '@/features/decks/components/A.module.css'")).toMatchObject([{ rule: 'feature-internal' }])
    expect(check('app/[lang]/decks/page.tsx', "import { x } from '@/features/decks/components/sub/A'")).toMatchObject([{ rule: 'feature-internal' }])
    expect(check('features/decks/lib/a.ts', "import A from '@/features/notes/components/A'")).toEqual([])
    expect(check('components/ui/Button.tsx', "import A from '@/features/decks/components/A'")).toMatchObject([{ rule: 'shared-imports-feature' }])
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
      "import { z } from '../../features/shop/lib/z'",
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

  it('REQ-SHARED-074 allows the server entry', () => {
    expect(check('app/[lang]/meta/page.tsx', "import { aggregate } from '@/features/meta/server'")).toEqual([])
    expect(check('app/[lang]/meta/page.tsx', "import { x } from '@/features/meta/server/aggregate'")).toMatchObject([{ rule: 'feature-internal' }])
    expect(check('components/ui/Button.tsx', "import { aggregate } from '@/features/meta/server'")).toMatchObject([{ rule: 'shared-imports-feature' }])
  })

  it('REQ-SHARED-076 the feature entry does not export server code', () => {
    const out = check('features/meta/index.ts', "export * from './server/aggregate'")
    expect(out).toMatchObject([{ file: 'features/meta/index.ts', rule: 'entry-exports-server' }])
    expect(check('features/meta/index.ts', "export { A } from '@/features/meta/server'")).toMatchObject([{ rule: 'entry-exports-server' }])
    const viaServerOnly = findImportViolations([
      { path: 'features/meta/index.ts', source: "export { read } from './lib/read'" },
      { path: 'features/meta/lib/read.ts', source: "import 'server-only'\nexport const read = 1" },
    ])
    expect(viaServerOnly).toMatchObject([{ file: 'features/meta/index.ts', rule: 'entry-exports-server' }])
  })

  it('REQ-SHARED-076 lets the entry export client-safe code and the server folder import server-only', () => {
    const files = [
      { path: 'features/meta/index.ts', source: "export { a } from './lib/a'\nexport type { T } from './types'" },
      { path: 'features/meta/lib/a.ts', source: 'export const a = 1' },
      { path: 'features/meta/server/index.ts', source: "import 'server-only'\nexport const aggregate = 1" },
    ]
    expect(findImportViolations(files)).toEqual([])
  })

  it('REQ-SHARED-074 the feature entry does not export components or hooks', () => {
    expect(check('features/meta/index.ts', "export { A } from './components/A'")).toMatchObject([{ rule: 'entry-exports-ui' }])
    expect(check('features/meta/index.ts', "export { useA } from '@/features/meta/hooks/useA'")).toMatchObject([{ rule: 'entry-exports-ui' }])
    expect(check('features/meta/index.ts', "export type { T } from './components/A'")).toMatchObject([{ rule: 'entry-exports-ui' }])
    const viaClient = findImportViolations([
      { path: 'features/meta/index.ts', source: "export { read } from './lib/read'" },
      { path: 'features/meta/lib/read.ts', source: "'use client'\nexport const read = 1" },
    ])
    expect(viaClient).toMatchObject([{ file: 'features/meta/index.ts', rule: 'entry-exports-ui' }])
    expect(check('features/meta/index.ts', "export { x } from './lib/x'\nexport type { T } from './types'")).toEqual([])
  })

  it('REQ-SHARED-074 a feature does not import from app', () => {
    expect(check('features/decks/components/A.tsx', "import s from '@/app/[lang]/decks/X.module.css'")).toMatchObject([{ rule: 'feature-imports-app' }])
    expect(check('features/decks/lib/a.ts', "import { x } from '../../../app/[lang]/decks/x'")).toMatchObject([{ rule: 'feature-imports-app' }])
    expect(check('features/decks/lib/a.ts', "import { x } from '@/lib/x'")).toEqual([])
    expect(check('app/[lang]/decks/page.tsx', "import { x } from '@/app/[lang]/decks/x'")).toEqual([])
  })

  it('REQ-SHARED-077 tests live under tests/ only', () => {
    const tracked = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' })
    const outside = tracked.split('\n').filter((p) => p && !p.startsWith('tests/'))
    expect(outside).toEqual([])
  })

  it('REQ-SHARED-074 the repository has no violations', () => {
    const tracked = execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'hooks', 'features', 'proxy.ts', ':(glob)instrumentation*.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const files = tracked
      .split('\n')
      .filter((p) => /\.tsx?$/.test(p) && existsSync(p))
      .map((p) => ({ path: p, source: readFileSync(p, 'utf8') }))
    expect(files.length).toBeGreaterThan(0)
    expect(findImportViolations(files)).toEqual([])
  })
})

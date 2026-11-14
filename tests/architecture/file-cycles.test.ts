import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findFileCycles } from './imports'

const cycles = (files: Record<string, string>) => findFileCycles(Object.entries(files).map(([path, source]) => ({ path, source })))

describe('file import cycles', () => {
  it('finds two files that import each other', () => {
    expect(cycles({ 'lib/a.ts': "import { b } from './b'", 'lib/b.ts': "import { a } from '@/lib/a'" })).toEqual([['lib/a.ts', 'lib/b.ts']])
  })

  it('finds a longer loop as one group', () => {
    const out = cycles({ 'lib/a.ts': "import './b'", 'lib/b.ts': "import './c'", 'lib/c.ts': "import './a'", 'lib/d.ts': "import './a'" })
    expect(out).toEqual([['lib/a.ts', 'lib/b.ts', 'lib/c.ts']])
  })

  it('counts type imports and dynamic imports, which tangle the files just the same', () => {
    expect(cycles({ 'lib/a.ts': "import type { B } from './b'", 'lib/b.ts': "const a = await import('./a')" })).toHaveLength(1)
  })

  it('leaves one-way imports, a file importing itself and packages alone', () => {
    expect(cycles({ 'lib/a.ts': "import './b'\nimport 'react'", 'lib/b.ts': "import './b'" })).toEqual([])
  })

  it('the repository has no import cycle between files', () => {
    const tracked = execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'hooks', 'features', 'proxy.ts', ':(glob)instrumentation*.ts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const files = tracked
      .split('\n')
      .filter((p) => /\.tsx?$/.test(p) && existsSync(p))
      .map((p) => ({ path: p, source: readFileSync(p, 'utf8') }))
    expect(files.length).toBeGreaterThan(0)
    expect(findFileCycles(files)).toEqual([])
  })
})

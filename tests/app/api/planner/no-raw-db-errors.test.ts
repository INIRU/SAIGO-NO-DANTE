import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = 'app/api/planner'
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : []
})

describe('planner API', () => {
  it('no response body carries a DB error message', () => {
    const leaks = files(root).filter(path => /NextResponse\.json\(\{\s*error:\s*[\w.]*\.message\b/.test(readFileSync(path, 'utf8')))
    expect(leaks).toEqual([])
  })

  it('the view route checks the plan id and catches failures', () => {
    const source = readFileSync(join(root, '[id]/view/route.ts'), 'utf8')
    expect(source).toContain('isUuid(id)')
    expect(source).toMatch(/try \{[\s\S]*catch/)
  })
})

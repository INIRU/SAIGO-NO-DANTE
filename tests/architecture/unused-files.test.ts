import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findUnimportedFiles } from './imports'

// import 없이도 쓰이는 파일. 새로 넣을 때는 왜 쓰이는지 적는다.
const ALLOWED = [
  // next.config.ts의 createNextIntlPlugin('./lib/i18n/request.ts')가 경로 문자열로 읽는다.
  'lib/i18n/request.ts',
  // package.json의 build:assist-worker, build:assist-ocr가 esbuild 시작 파일로 직접 묶는다.
  'features/assist/lib/scene-worker.ts',
  'features/assist/lib/frame-tape-worker.ts',
  'features/assist/lib/ocr-worker.ts',
  // scripts/db/gen-types.mjs가 만드는 DB 타입. Supabase 클라이언트에 붙이는 다음 단계에서 import되면 이 줄을 지운다.
  'lib/supabase/database.types.ts',
]

const find = (files: Record<string, string>, allowed: string[] = []) =>
  findUnimportedFiles(Object.entries(files).map(([path, source]) => ({ path, source })), allowed)

describe('files nothing imports', () => {
  it('flags a file no one imports', () => {
    expect(find({ 'lib/a.ts': 'export const a = 1', 'lib/b.ts': 'export const b = 1', 'app/page.tsx': "import { a } from '@/lib/a'" })).toEqual(['lib/b.ts'])
  })

  it('reads aliases, relative paths, index files, type imports, re-exports and dynamic imports', () => {
    const files = {
      'app/page.tsx': "import { a } from '@/lib/a'\nimport type { B } from '../lib/b'\nexport { c } from '@/lib/c'\nconst d = await import('@/lib/d')",
      'lib/a.ts': 'export const a = 1',
      'lib/b.ts': 'export type B = 1',
      'lib/c/index.ts': 'export const c = 1',
      'lib/d.tsx': 'export const d = 1',
    }
    expect(find(files)).toEqual([])
  })

  it('does not count a file importing itself', () => {
    expect(find({ 'lib/a.ts': "import { a } from './a'" })).toEqual(['lib/a.ts'])
  })

  it('leaves Next convention files, declaration files and the allow list alone', () => {
    const files = { 'app/[lang]/page.tsx': '', 'app/[lang]/x/route.ts': '', 'app/sitemap.ts': '', 'lib/types.d.ts': '', 'lib/i18n/request.ts': '' }
    expect(find(files, ['lib/i18n/request.ts'])).toEqual([])
  })

  it('the repository has no source file that nothing imports', () => {
    // 들어오는 쪽에는 tests/·e2e/를 세지 않는다. 테스트에서만 쓰는 파일도 안 쓰이는 파일이다.
    const tracked = execFileSync('git', ['ls-files', ':(glob)**/*.ts', ':(glob)**/*.tsx', ':(glob)**/*.mts', ':(glob)**/*.mjs', ':(glob)**/*.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const files = tracked
      .split('\n')
      .filter((p) => p && !/^(tests|e2e|public)\//.test(p) && existsSync(p))
      .map((p) => ({ path: p, source: readFileSync(p, 'utf8') }))
    expect(files.length).toBeGreaterThan(0)
    expect(findUnimportedFiles(files, ALLOWED)).toEqual([])
  })
})

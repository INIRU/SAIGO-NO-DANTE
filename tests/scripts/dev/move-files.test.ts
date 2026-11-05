import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { expandRenames, externalImporters, rewriteSources } from '../../../scripts/dev/move-files.mjs'

// 가짜 기능 이름(gizmo)을 쓴다. 실제 폴더 이름을 쓰면 나중에 이 도구가 이 테스트의 예시 글자까지 고친다.
const renames: Array<[string, string]> = [
  ['components/gizmo/GizmoCard.tsx', 'features/gizmo/components/GizmoCard.tsx'],
  ['components/gizmo/GizmoCard.module.css', 'features/gizmo/components/GizmoCard.module.css'],
  ['components/gizmo/index.ts', 'features/gizmo/components/index.ts'],
  ['lib/gizmo/guide.ts', 'features/gizmo/lib/guide.ts'],
]
const rewrite = (path: string, source: string, extra: Array<[string, string]> = renames) =>
  rewriteSources(extra, [{ path, source }])

describe('REQ-SHARED-079 rewriteSources', () => {
  it('REQ-SHARED-079 rewrites alias imports, keeping the extension style, .module.css and a dropped /index', () => {
    const [out] = rewrite(
      'app/[lang]/gizmo/page.tsx',
      [
        "import { GizmoCard } from '@/components/gizmo/GizmoCard'",
        "import styles from '@/components/gizmo/GizmoCard.module.css'",
        "import { GizmoList } from '@/components/gizmo'",
        "import { guide } from '@/lib/gizmo/guide'",
      ].join('\n'),
    )
    expect(out.path).toBe('app/[lang]/gizmo/page.tsx')
    expect(out.source).toBe(
      [
        "import { GizmoCard } from '@/features/gizmo/components/GizmoCard'",
        "import styles from '@/features/gizmo/components/GizmoCard.module.css'",
        "import { GizmoList } from '@/features/gizmo/components'",
        "import { guide } from '@/features/gizmo/lib/guide'",
      ].join('\n'),
    )
  })

  it('REQ-SHARED-079 turns a relative import inside a moved file into an alias to the same file', () => {
    const [out] = rewrite(
      'components/gizmo/GizmoCard.tsx',
      "import { Button } from '../ui/Button'\nimport styles from './GizmoCard.module.css'\nimport { guide } from '../../lib/gizmo/guide'\n",
    )
    expect(out.path).toBe('features/gizmo/components/GizmoCard.tsx')
    expect(out.source).toBe(
      "import { Button } from '@/components/ui/Button'\nimport styles from './GizmoCard.module.css'\nimport { guide } from '@/features/gizmo/lib/guide'\n",
    )
  })

  it('REQ-SHARED-079 points a relative import in an unmoved file at the new location', () => {
    const [out] = rewrite('components/other/Thing.tsx', "import { GizmoCard } from '../gizmo/GizmoCard'\nimport { x } from './x'\n")
    expect(out.source).toBe("import { GizmoCard } from '@/features/gizmo/components/GizmoCard'\nimport { x } from './x'\n")
  })

  it('REQ-SHARED-079 rewrites vi.mock, dynamic import and readFileSync paths', () => {
    const [out] = rewrite(
      'tests/components/gizmo/GizmoCard.test.tsx',
      [
        "vi.mock('@/lib/gizmo/guide', () => ({}))",
        "const mod = await import('@/lib/gizmo/guide')",
        "const src = readFileSync('components/gizmo/GizmoCard.tsx', 'utf8')",
      ].join('\n'),
    )
    expect(out.source).toBe(
      [
        "vi.mock('@/features/gizmo/lib/guide', () => ({}))",
        "const mod = await import('@/features/gizmo/lib/guide')",
        "const src = readFileSync('features/gizmo/components/GizmoCard.tsx', 'utf8')",
      ].join('\n'),
    )
  })

  it('REQ-SHARED-079 rewrites backticked paths and relative links in markdown', () => {
    const [spec] = rewrite('docs/reference/gizmo.md', '- `components/gizmo/GizmoCard.tsx` — 수정\n- `lib/gizmo/guide.ts`.\n')
    expect(spec.source).toBe('- `features/gizmo/components/GizmoCard.tsx` — 수정\n- `features/gizmo/lib/guide.ts`.\n')

    const [doc] = rewrite('docs/guides/gizmo.md', '[guide](../../lib/gizmo/guide.ts#top) and [card](../../components/gizmo/GizmoCard.tsx)\n')
    expect(doc.source).toBe(
      '[guide](../../features/gizmo/lib/guide.ts#top) and [card](../../features/gizmo/components/GizmoCard.tsx)\n',
    )
  })

  it('REQ-SHARED-079 keeps a markdown link valid when the markdown file itself moves', () => {
    const [out] = rewrite('docs/note.md', '[g](../lib/gizmo/guide.ts) [u](../lib/utils.ts)\n', [
      ['docs/note.md', 'docs/guides/note.md'],
      ...renames,
    ])
    expect(out.path).toBe('docs/guides/note.md')
    expect(out.source).toBe('[g](../../features/gizmo/lib/guide.ts) [u](../../lib/utils.ts)\n')
  })

  it('REQ-SHARED-079 leaves a path that only shares a prefix with a moved file', () => {
    const source = [
      "import { steps } from '@/lib/gizmo/guide-steps'",
      "import { guide } from '@/lib/gizmo/guide'",
      '`lib/gizmo/guide-steps.ts` and `lib/gizmo/guide.test.ts`',
    ].join('\n')
    const [out] = rewrite('app/x.tsx', source)
    expect(out.source).toBe(
      [
        "import { steps } from '@/lib/gizmo/guide-steps'",
        "import { guide } from '@/features/gizmo/lib/guide'",
        '`lib/gizmo/guide-steps.ts` and `lib/gizmo/guide.test.ts`',
      ].join('\n'),
    )
  })

  it("REQ-SHARED-079 keeps 'use client' and 'use cache' as the first line", () => {
    const [client] = rewrite('components/gizmo/GizmoCard.tsx', "'use client'\n\nimport { Button } from '../ui/Button'\n")
    expect(client.source.startsWith("'use client'\n")).toBe(true)
    const [cached] = rewrite('lib/gizmo/guide.ts', "'use cache'\n\nimport { db } from '../db/client'\n")
    expect(cached.source).toBe("'use cache'\n\nimport { db } from '@/lib/db/client'\n")
  })

  it('REQ-SHARED-079 returns only changed files, with the new path for moved ones', () => {
    const out = rewriteSources(renames, [
      { path: 'lib/gizmo/guide.ts', source: 'export const guide = 1\n' },
      { path: 'app/a.tsx', source: "import { b } from '@/lib/b'\n" },
      { path: 'app/b.tsx', source: "import { guide } from '@/lib/gizmo/guide'\n" },
    ])
    expect(out.map((f) => f.path)).toEqual(['app/b.tsx'])
  })

  it('REQ-SHARED-079 keeps next.config.ts on relative specifiers and rewrites plain string paths', () => {
    const [out] = rewrite(
      'next.config.ts',
      "import { guide } from './lib/gizmo/guide'\nconst plugin = createNextIntlPlugin('./lib/gizmo/guide.ts')\n",
    )
    expect(out.source).toBe(
      "import { guide } from './features/gizmo/lib/guide'\nconst plugin = createNextIntlPlugin('./features/gizmo/lib/guide.ts')\n",
    )
  })

  it('REQ-SHARED-079 keeps node-run scripts and .mjs files on relative specifiers', () => {
    const [mjs] = rewrite('scripts/tool/run.mjs', "import { guide } from '../../lib/gizmo/guide.ts'\n")
    expect(mjs.source).toBe("import { guide } from '../../features/gizmo/lib/guide.ts'\n")
    const [ts] = rewrite('scripts/tool/run.ts', "import { guide } from '../../lib/gizmo/guide'\n")
    expect(ts.source).toBe("import { guide } from '../../features/gizmo/lib/guide'\n")
    // 번들러가 읽는 파일은 계속 별칭
    const [app] = rewrite('proxy.ts', "import { guide } from './lib/gizmo/guide'\n")
    expect(app.source).toBe("import { guide } from '@/features/gizmo/lib/guide'\n")
  })

  it('REQ-SHARED-079 rewrites repo paths in package.json scripts and workflow files', () => {
    const [pkg] = rewrite(
      'package.json',
      '{ "scripts": { "build:x": "esbuild lib/gizmo/guide.ts --bundle --outfile=public/guide.js && cp lib/gizmo/guide-steps.ts public/" } }\n',
    )
    expect(pkg.source).toBe(
      '{ "scripts": { "build:x": "esbuild features/gizmo/lib/guide.ts --bundle --outfile=public/guide.js && cp lib/gizmo/guide-steps.ts public/" } }\n',
    )
    const [yml] = rewrite(
      '.github/workflows/ci.yml',
      "on:\n  pull_request:\n    paths:\n      - 'lib/gizmo/guide.ts'\n      - lib/gizmo/guide-steps.ts\njobs:\n  a:\n    steps:\n      - run: node scripts/check.mjs lib/gizmo/guide.ts\n",
    )
    expect(yml.source).toBe(
      "on:\n  pull_request:\n    paths:\n      - 'features/gizmo/lib/guide.ts'\n      - lib/gizmo/guide-steps.ts\njobs:\n  a:\n    steps:\n      - run: node scripts/check.mjs features/gizmo/lib/guide.ts\n",
    )
  })

  it('REQ-SHARED-079 rewrites a folder mention when the folder map is given', () => {
    const [out] = rewriteSources(renames, [{ path: 'docs/a.md', source: 'See `components/gizmo/` and `components/gizmo-extra`.\n' }], [
      ['components/gizmo', 'features/gizmo/components'],
    ])
    expect(out.source).toBe('See `features/gizmo/components/` and `components/gizmo-extra`.\n')
  })
})

describe('REQ-SHARED-079 expandRenames', () => {
  const tracked = ['components/gizmo/a.tsx', 'components/gizmo/sub/b.ts', 'components/gizmo-extra/c.ts', 'lib/one.ts']

  it('REQ-SHARED-079 expands a folder entry to every tracked file under it', () => {
    const { renames: out, dirs } = expandRenames(
      ['# comment', '', 'components/gizmo features/gizmo/components', 'lib/one.ts features/gizmo/lib/one.ts'],
      tracked,
    )
    expect(out).toEqual([
      ['components/gizmo/a.tsx', 'features/gizmo/components/a.tsx'],
      ['components/gizmo/sub/b.ts', 'features/gizmo/components/sub/b.ts'],
      ['lib/one.ts', 'features/gizmo/lib/one.ts'],
    ])
    expect(dirs).toEqual([['components/gizmo', 'features/gizmo/components']])
  })

  it('REQ-SHARED-079 rejects a file that appears twice in the map', () => {
    expect(() => expandRenames(['components/gizmo a/b', 'components/gizmo/a.tsx c/d.tsx'], tracked)).toThrow(/components\/gizmo\/a\.tsx/)
    expect(() => expandRenames(['lib/one.ts a.ts', 'lib/one.ts b.ts'], tracked)).toThrow(/lib\/one\.ts/)
  })

  it('REQ-SHARED-079 rejects a line with no tracked file and a malformed line', () => {
    expect(() => expandRenames(['nowhere/x a/b'], tracked)).toThrow(/nowhere\/x/)
    expect(() => expandRenames(['only-one-column'], tracked)).toThrow(/only-one-column/)
  })
})

describe('REQ-SHARED-079 externalImporters', () => {
  it('REQ-SHARED-079 lists importers outside the move with the names they use', () => {
    const out = externalImporters(renames, [
      {
        path: 'app/page.tsx',
        source: [
          "import GizmoCard, { type GizmoProps, helper as h } from '@/components/gizmo/GizmoCard'",
          "import * as guide from '../lib/gizmo/guide'",
          "import '@/components/gizmo/GizmoCard.module.css'",
        ].join('\n'),
      },
      { path: 'app/lazy.tsx', source: "const m = () => import('@/lib/gizmo/guide')\nexport { a, b } from '@/components/gizmo'" },
      // 같이 옮기는 파일끼리의 import와 상관없는 import는 바깥 사용처가 아니다
      { path: 'components/gizmo/GizmoCard.tsx', source: "import { guide } from '@/lib/gizmo/guide'" },
      { path: 'app/none.tsx', source: "import { x } from '@/lib/other'" },
    ])
    expect(out).toEqual([
      { importer: 'app/page.tsx', target: 'components/gizmo/GizmoCard.module.css', names: [] },
      { importer: 'app/page.tsx', target: 'components/gizmo/GizmoCard.tsx', names: ['default', 'GizmoProps', 'helper'] },
      { importer: 'app/lazy.tsx', target: 'components/gizmo/index.ts', names: ['a', 'b'] },
      { importer: 'app/lazy.tsx', target: 'lib/gizmo/guide.ts', names: ['*'] },
      { importer: 'app/page.tsx', target: 'lib/gizmo/guide.ts', names: ['*'] },
    ])
  })
})

describe('REQ-SHARED-079 CLI', () => {
  const script = resolve('scripts/dev/move-files.mjs')
  const dirs: string[] = []
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

  const git = (cwd: string, ...args: string[]) =>
    spawnSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' })
  const put = (root: string, path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  // 작은 git 저장소: 옮길 파일 하나와 그것을 가져오는 파일 하나
  function repo() {
    const root = mkdtempSync(join(tmpdir(), 'move-files-'))
    dirs.push(root)
    git(root, 'init', '-q')
    put(root, 'lib/gizmo/guide.ts', 'export const guide = 1\n')
    put(root, 'app/page.tsx', "import { guide } from '@/lib/gizmo/guide'\n")
    put(root, 'map.txt', 'lib/gizmo features/gizmo/lib\n')
    git(root, 'add', 'lib/gizmo/guide.ts', 'app/page.tsx', 'map.txt')
    git(root, 'commit', '-q', '-m', 'init')
    return root
  }
  const run = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' })

  it('REQ-SHARED-079 prints the usage and exits with 1 when no map is given', () => {
    const out = spawnSync(process.execPath, ['scripts/dev/move-files.mjs'], { encoding: 'utf8' })
    expect(out.status).toBe(1)
    expect(out.stderr).toContain('사용법')
  })

  it('REQ-SHARED-079 only prints the plan without --write', () => {
    const root = repo()
    const out = run(root, 'map.txt')
    expect(out.status).toBe(0)
    expect(out.stdout).toContain('lib/gizmo/guide.ts -> features/gizmo/lib/guide.ts')
    expect(existsSync(join(root, 'lib/gizmo/guide.ts'))).toBe(true)
    expect(readFileSync(join(root, 'app/page.tsx'), 'utf8')).toContain('@/lib/gizmo/guide')
  })

  it('REQ-SHARED-079 moves with git mv and rewrites the importers with --write', () => {
    const root = repo()
    const out = run(root, 'map.txt', '--write')
    expect(out.status).toBe(0)
    expect(existsSync(join(root, 'lib/gizmo/guide.ts'))).toBe(false)
    expect(readFileSync(join(root, 'features/gizmo/lib/guide.ts'), 'utf8')).toBe('export const guide = 1\n')
    expect(readFileSync(join(root, 'app/page.tsx'), 'utf8')).toBe("import { guide } from '@/features/gizmo/lib/guide'\n")
    expect(git(root, 'status', '--short').stdout).toContain('R  lib/gizmo/guide.ts -> features/gizmo/lib/guide.ts')
  })

  it('REQ-SHARED-079 also scans package.json and .github workflows', () => {
    const root = repo()
    put(root, 'package.json', '{ "scripts": { "build": "esbuild lib/gizmo/guide.ts --bundle" } }\n')
    put(root, '.github/workflows/ci.yml', "paths:\n  - 'lib/gizmo/guide.ts'\n")
    git(root, 'add', 'package.json', '.github/workflows/ci.yml')
    git(root, 'commit', '-q', '-m', 'more')
    expect(run(root, 'map.txt', '--write').status).toBe(0)
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toContain('esbuild features/gizmo/lib/guide.ts')
    expect(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).toContain("'features/gizmo/lib/guide.ts'")
  })

  it('REQ-SHARED-079 refuses when the target already exists', () => {
    const root = repo()
    put(root, 'features/gizmo/lib/guide.ts', 'other\n')
    const out = run(root, 'map.txt', '--write')
    expect(out.status).toBe(1)
    expect(out.stderr).toContain('이미 파일이 있습니다')
    expect(existsSync(join(root, 'lib/gizmo/guide.ts'))).toBe(true)
  })

  it('REQ-SHARED-079 refuses when a file it would touch has unstaged changes', () => {
    const root = repo()
    put(root, 'app/page.tsx', "import { guide } from '@/lib/gizmo/guide'\n// edited\n")
    const out = run(root, 'map.txt', '--write')
    expect(out.status).toBe(1)
    expect(out.stderr).toContain('스테이지하지 않은 변경')
    expect(existsSync(join(root, 'lib/gizmo/guide.ts'))).toBe(true)
  })

  it('REQ-SHARED-079 refuses a map that lists the same file twice', () => {
    const root = repo()
    put(root, 'dup.txt', 'lib/gizmo features/gizmo/lib\nlib/gizmo/guide.ts features/other/guide.ts\n')
    const out = run(root, 'dup.txt', '--write')
    expect(out.status).toBe(1)
    expect(out.stderr).toContain('두 번')
    expect(existsSync(join(root, 'lib/gizmo/guide.ts'))).toBe(true)
  })
})

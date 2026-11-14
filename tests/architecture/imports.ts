import { posix } from 'node:path'

export type Violation = { file: string; specifier: string; rule: 'feature-internal' | 'shared-imports-feature' | 'entry-exports-server' | 'entry-exports-ui' | 'feature-imports-app' }

// 기능 위에 있는 공용 코드: components/ 전체(ui, layout, providers, brand, cards …), lib, hooks.
const SHARED = /^(components|lib|hooks)\//
const SERVER_ONLY = /\bimport\s*(['"])server-only\1/
// 입구 파일 말고 밖에서 가져올 수 있는 한 파일 경로: `@/features/<기능>/components/<이름>`, `@/features/<기능>/hooks/<이름>`.
const PUBLIC_FILE = /^\/(?:components|hooks)\/[A-Za-z0-9]+$/
// 첫 문장이 'use client' 지시문인 파일.
const USE_CLIENT = /^\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*(['"])use client\1/
const SKIPPED = /^(tests|e2e)\//
// `from '…'` (import/export), side-effect `import '…'`, and dynamic `import('…')`.
// Regex, not a parser; a specifier-looking string inside a comment is also read. Switch to the TypeScript AST if that ever bites.
const SPECIFIER = /\b(?:from|import)\s*\(?\s*(['"])([^'"\n]+)\1/g

function resolve(file: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return specifier.slice(2)
  if (specifier.startsWith('./') || specifier.startsWith('../')) return posix.join(posix.dirname(file), specifier)
  return null
}

export function findImportViolations(files: { path: string; source: string }[]): Violation[] {
  const violations: Violation[] = []
  const serverOnly = new Set(files.filter((f) => SERVER_ONLY.test(f.source)).map((f) => f.path.replace(/(\/index)?\.tsx?$/, '')))
  const useClient = new Set(files.filter((f) => USE_CLIENT.test(f.source)).map((f) => f.path.replace(/(\/index)?\.tsx?$/, '')))
  for (const { path, source } of files) {
    if (SKIPPED.test(path)) continue
    const own = /^features\/([^/]+)\//.exec(path)?.[1]
    const entry = /^features\/([^/]+)\/index\.tsx?$/.exec(path)?.[1]
    for (const match of source.matchAll(SPECIFIER)) {
      const specifier = match[2]
      const target = resolve(path, specifier)
      if (entry && target && (target === `features/${entry}/server` || target.startsWith(`features/${entry}/server/`) || serverOnly.has(target))) {
        violations.push({ file: path, specifier, rule: 'entry-exports-server' })
        continue
      }
      if (entry && target && (target === `features/${entry}/components` || target.startsWith(`features/${entry}/components/`) || target === `features/${entry}/hooks` || target.startsWith(`features/${entry}/hooks/`) || useClient.has(target))) {
        violations.push({ file: path, specifier, rule: 'entry-exports-ui' })
        continue
      }
      if (own && target?.startsWith('app/')) {
        violations.push({ file: path, specifier, rule: 'feature-imports-app' })
        continue
      }
      const hit = target && /^features\/([^/]+)(\/.+)?$/.exec(target)
      if (!hit) continue
      if (SHARED.test(path)) violations.push({ file: path, specifier, rule: 'shared-imports-feature' })
      else if (hit[2] && hit[2] !== '/server' && !PUBLIC_FILE.test(hit[2]) && hit[1] !== own) violations.push({ file: path, specifier, rule: 'feature-internal' })
    }
  }
  return violations
}

// Next가 파일 이름만 보고 읽는 규약 파일. 다른 파일이 import하지 않아도 쓰인다.
const NEXT_CONVENTION = /^app\/(?:.*\/)?(?:page|layout|template|route|loading|error|global-error|not-found|default|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.tsx?$/
const UNUSED_SCOPE = /^(?:app|components|features|lib|hooks)\/.+\.tsx?$/
// `from '…'`, `import '…'`, `import('…')`, `require('…')`, `new URL('…', import.meta.url)`
const ANY_SPECIFIER = /\b(?:from|import|require|URL)\s*\(?\s*(['"])([^'"\n]+)\1/g

/**
 * 소스 파일 가운데 어디서도 import되지 않는 것. 들어오는 쪽은 `files`에 넘긴 파일뿐이라, tests/는 넘기지 않는다.
 * `allowed`는 import 없이도 쓰이는 파일(설정이 경로 문자열로 가리키는 것 등).
 */
export function findUnimportedFiles(files: { path: string; source: string }[], allowed: readonly string[] = []): string[] {
  const known = new Set(files.map((f) => f.path))
  const imported = new Set<string>()
  for (const { path, source } of files) {
    for (const match of source.matchAll(ANY_SPECIFIER)) {
      const target = resolve(path, match[2])
      if (!target) continue
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`]) {
        if (candidate !== path && known.has(candidate)) imported.add(candidate)
      }
    }
  }
  return files
    .map((f) => f.path)
    .filter((p) => UNUSED_SCOPE.test(p) && !p.endsWith('.d.ts') && !NEXT_CONVENTION.test(p) && !allowed.includes(p) && !imported.has(p))
}

// 모든 import의 파일 이름 해석에 쓰는 후보. 확장자·/index가 생략될 수 있다.
const SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

export type ImportEdge = { from: string; to: string }

/** 넘겨 준 파일끼리의 import 관계. 타입만 가져오는 import도 센다(런타임에는 지워져도 두 파일이 서로의 모양을 알아야 하기 때문이다). */
export function importEdges(files: { path: string; source: string }[]): ImportEdge[] {
  const known = new Set(files.map((f) => f.path))
  const edges: ImportEdge[] = []
  for (const { path, source } of files) {
    for (const match of source.matchAll(SPECIFIER)) {
      const target = resolve(path, match[2])
      if (!target) continue
      const to = SUFFIXES.map((s) => target + s).find((candidate) => known.has(candidate))
      if (to && to !== path) edges.push({ from: path, to })
    }
  }
  return edges
}

/** 서로 오가는 묶음(강한 연결 요소) 가운데 둘 이상으로 이루어진 것. Tarjan 알고리즘, 재귀 없이. */
function cycleGroups(nodes: string[], edges: ImportEdge[]): string[][] {
  const next = new Map<string, string[]>(nodes.map((n) => [n, []]))
  for (const { from, to } of edges) next.get(from)?.push(to)
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const groups: string[][] = []
  let counter = 0
  for (const root of nodes) {
    if (index.has(root)) continue
    const work: { node: string; i: number }[] = [{ node: root, i: 0 }]
    while (work.length) {
      const frame = work[work.length - 1]
      const { node } = frame
      if (frame.i === 0) {
        index.set(node, counter)
        low.set(node, counter)
        counter += 1
        stack.push(node)
        onStack.add(node)
      }
      const targets = next.get(node) ?? []
      if (frame.i < targets.length) {
        const target = targets[frame.i]
        frame.i += 1
        if (!index.has(target)) work.push({ node: target, i: 0 })
        else if (onStack.has(target)) low.set(node, Math.min(low.get(node)!, index.get(target)!))
        continue
      }
      work.pop()
      const parent = work[work.length - 1]
      if (parent) low.set(parent.node, Math.min(low.get(parent.node)!, low.get(node)!))
      if (low.get(node) === index.get(node)) {
        const group: string[] = []
        let member: string
        do {
          member = stack.pop()!
          onStack.delete(member)
          group.push(member)
        } while (member !== node)
        if (group.length > 1) groups.push(group.sort())
      }
    }
  }
  return groups.sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

/**
 * 파일끼리 서로를 불러오는 순환 묶음. 파일 하나가 자기 자신만 가져오는 경우는 세지 않는다.
 * 타입만 가져오는 import도 센다: 런타임 순환은 아니지만, 두 파일이 서로 얽혀 있다는 신호는 같다.
 */
export function findFileCycles(files: { path: string; source: string }[]): string[][] {
  return cycleGroups(files.map((f) => f.path), importEdges(files))
}

const featureOf = (path: string) => /^features\/([^/]+)\//.exec(path)?.[1]

/**
 * 서로를 직접·돌아서 가져오는 기능 묶음. 가져오는 쪽 기능이 하나의 방향으로만 흘러야(기능 A가 B를 쓰면 B는 A를 쓰지 않는다) 한다.
 * 각 묶음에는 그 안에서 서로를 가져오는 대표 파일 한 쌍씩을 `via`로 붙인다.
 */
export function findFeatureCycles(files: { path: string; source: string }[]): { features: string[]; via: string[] }[] {
  const pairs = new Map<string, string>()
  for (const { from, to } of importEdges(files)) {
    const a = featureOf(from)
    const b = featureOf(to)
    if (a && b && a !== b && !pairs.has(`${a}>${b}`)) pairs.set(`${a}>${b}`, `${from} -> ${to}`)
  }
  const names = [...new Set(files.map((f) => featureOf(f.path)).filter((f): f is string => !!f))]
  const edges = [...pairs.keys()].map((k) => ({ from: k.split('>')[0], to: k.split('>')[1] }))
  return cycleGroups(names, edges).map((features) => ({
    features,
    via: [...pairs].filter(([k]) => features.includes(k.split('>')[0]) && features.includes(k.split('>')[1])).map(([k, v]) => `${k}: ${v}`),
  }))
}

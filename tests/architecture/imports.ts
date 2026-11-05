import { posix } from 'node:path'

export type Violation = { file: string; specifier: string; rule: 'feature-internal' | 'shared-imports-feature' | 'entry-exports-server' | 'entry-exports-ui' | 'feature-imports-app' }

const SHARED = /^(components\/(ui|layout)|lib|hooks)\//
const SERVER_ONLY = /\bimport\s*(['"])server-only\1/
// 입구 파일 말고 밖에서 가져올 수 있는 한 파일 경로: `@/features/<기능>/components/<이름>`, `@/features/<기능>/hooks/<이름>`.
const PUBLIC_FILE = /^\/(?:components|hooks)\/[A-Za-z0-9]+$/
// 첫 문장이 'use client' 지시문인 파일.
const USE_CLIENT = /^\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*(['"])use client\1/
const SKIPPED = /^(tests|e2e)\//
// `from '…'` (import/export), side-effect `import '…'`, and dynamic `import('…')`.
// regex, not a parser; a specifier-looking string inside a comment is also read. Switch to the TypeScript AST if that ever bites.
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

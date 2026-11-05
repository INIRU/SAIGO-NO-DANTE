import { posix } from 'node:path'

export type Violation = { file: string; specifier: string; rule: 'feature-internal' | 'shared-imports-feature' }

const SHARED = /^(components\/(ui|layout)|lib|hooks)\//
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
  for (const { path, source } of files) {
    if (SKIPPED.test(path)) continue
    const own = /^features\/([^/]+)\//.exec(path)?.[1]
    for (const match of source.matchAll(SPECIFIER)) {
      const specifier = match[2]
      const target = resolve(path, specifier)
      const hit = target && /^features\/([^/]+)(\/.+)?$/.exec(target)
      if (!hit) continue
      if (SHARED.test(path)) violations.push({ file: path, specifier, rule: 'shared-imports-feature' })
      else if (hit[2] && hit[1] !== own) violations.push({ file: path, specifier, rule: 'feature-internal' })
    }
  }
  return violations
}

import { existsSync, readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const USE_CLIENT = /^\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*(['"])use client\1/
// static imports and re-exports only: `import type` / `export type` are erased, `import('…')` is a separate chunk
const STATIC = /^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s*)?(['"])([^'"\n]+)\1/gm

function file(path: string): string | null {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`]) {
    if (/\.(tsx?|mjs|js)$/.test(candidate) && existsSync(resolve(root, candidate))) return candidate
  }
  return null
}

/**
 * The npm packages and repo files the client code of `app/[lang]/layout.tsx` imports: from the layout, follow static imports; once a
 * 'use client' file is reached, everything it imports is client code that every page downloads.
 * regex, not a parser — good enough for this repo's import style; switch to the TS AST if it misreads.
 */
function layoutClient(): { packages: Map<string, string>; files: Set<string> } {
  const packages = new Map<string, string>()
  const files = new Set<string>()
  const seen = new Set<string>()
  const queue: [string, boolean][] = [['app/[lang]/layout.tsx', false]]
  while (queue.length) {
    const [path, parentClient] = queue.shift()!
    const source = readFileSync(resolve(root, path), 'utf8')
    const client = parentClient || USE_CLIENT.test(source)
    const key = `${path}|${client}`
    if (seen.has(key)) continue
    seen.add(key)
    if (client) files.add(path)
    for (const [, , specifier] of source.matchAll(STATIC)) {
      const local = specifier.startsWith('@/') ? specifier.slice(2)
        : specifier.startsWith('.') ? posix.join(posix.dirname(path), specifier) : null
      if (local === null) {
        if (client) packages.set(specifier, packages.get(specifier) ?? path)
        continue
      }
      const target = file(local)
      if (target) queue.push([target, client])
    }
  }
  return { packages, files }
}

describe('layout client weight', () => {
  it('REQ-SHARED-087 keeps validation, database clients and the translation table out of the code every page downloads', () => {
    const { packages, files } = layoutClient()
    const offenders = [...packages].filter(([name]) => /^(zod|@supabase\/supabase-js)(\/|$)/.test(name))
    expect(offenders, offenders.map(([name, from]) => `${name} ← ${from}`).join('\n')).toEqual([])
    // the whole three-language translation table (the layout passes each page only its own messages)
    expect(files.has('lib/i18n/translations.ts')).toBe(false)
    // the walk reaches the layout's client code at all
    expect(packages.has('motion/react')).toBe(true)
  })

  it('REQ-SHARED-087 loads the animation features after the page, so the motion engine is not in every first load', () => {
    const provider = readFileSync(resolve(root, 'components/ui/MotionProvider.tsx'), 'utf8')
    expect(provider).not.toMatch(/import\s*\{[^}]*\bdomAnimation\b[^}]*\}\s*from/)
    expect(provider).toMatch(/features=\{loadFeatures\}/)
  })
})

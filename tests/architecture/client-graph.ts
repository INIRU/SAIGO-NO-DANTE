import { existsSync, readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'

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
 * The npm packages and repo files the client code of a server entry (a layout or page) imports: from the entry, follow static
 * imports; once a 'use client' file is reached, everything it imports is client code the browser downloads with it.
 * regex, not a parser — good enough for this repo's import style; switch to the TS AST if it misreads.
 */
export function clientGraph(entry: string): { packages: Map<string, string>; files: Set<string> } {
  const packages = new Map<string, string>()
  const files = new Set<string>()
  const seen = new Set<string>()
  const queue: [string, boolean][] = [[entry, false]]
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

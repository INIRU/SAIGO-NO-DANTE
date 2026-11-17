import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function walk(dir: string, keep: (file: string) => boolean): string[] {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return []
  return readdirSync(full).flatMap(name => {
    const path = join(dir, name)
    return statSync(join(ROOT, path)).isDirectory() ? walk(path, keep) : keep(path) ? [path] : []
  })
}

const isMarkdown = (file: string) => file.endsWith('.md')
/** The documents people are told to read. */
const GUIDES = [
  'README.md', 'CONTRIBUTING.md', 'DESIGN.md',
  ...walk('.github', isMarkdown),
].filter(file => existsSync(join(ROOT, file)))

/** Relative link targets of a markdown file, without the #anchor or :line suffix. */
function relativeLinks(file: string): string[] {
  const text = readFileSync(join(ROOT, file), 'utf8')
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map(match => decodeURIComponent(match[1]))
    .filter(target => !/^(https?:|mailto:|#|<)/.test(target))
    .map(target => target.replace(/#.*$/, '').replace(/:\d+$/, ''))
    .filter(Boolean)
}

describe('guide documents', () => {
  it('relative links in the guide documents point at files that exist', () => {
    const broken = GUIDES.flatMap(file => relativeLinks(file)
      .filter(target => !existsSync(resolve(ROOT, dirname(file), target)))
      .map(target => `${file} -> ${target}`))
    expect(broken).toEqual([])
  })

  it('development documents stay out of the repository (kept privately since 2026-11-17)', () => {
    expect(existsSync(join(ROOT, 'docs'))).toBe(false)
  })

  it('nothing points at the removed docs/data-pipeline.md', () => {
    expect(existsSync(join(ROOT, 'docs/data-pipeline.md'))).toBe(false)
    const sources = [
      ...GUIDES,
      ...['scripts', 'lib'].flatMap(dir => walk(dir, file => /\.(ts|tsx|mjs|cjs|py)$/.test(file))),
    ]
    expect(sources.filter(file => readFileSync(join(ROOT, file), 'utf8').includes('data-pipeline.md'))).toEqual([])
  })
})

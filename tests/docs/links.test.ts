import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

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
  'DESIGN.md',
  ...['docs', '.github'].flatMap(dir => walk(dir, isMarkdown)),
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

describe('REQ-SHARED-028 guide documents', () => {
  it('REQ-SHARED-028 relative links in the guide documents point at files that exist', () => {
    const broken = GUIDES.flatMap(file => relativeLinks(file)
      .filter(target => !existsSync(resolve(ROOT, dirname(file), target)))
      .map(target => `${file} -> ${target}`))
    expect(broken).toEqual([])
  })

  it('REQ-SHARED-028 docs/README.md starts new work and links every data-sync document and the assist document', () => {
    const readme = readFileSync(join(ROOT, 'docs/README.md'), 'utf8')
    expect(readme).toContain('## 새 작업 시작하기')
    const linked = new Set(relativeLinks('docs/README.md'))
    const wanted = [...walk('docs/data-sync', isMarkdown), 'docs/assist.md'].map(file => relative('docs', file))
    expect(wanted).toEqual(expect.arrayContaining([
      'data-sync/runbook.md', 'data-sync/developing.md', 'data-sync/rules.md',
      'data-sync/adding-a-field.md', 'data-sync/provenance.md', 'assist.md',
    ]))
    expect(wanted.filter(file => !linked.has(file))).toEqual([])
  })

  it('REQ-SHARED-028 nothing points at the removed docs/data-pipeline.md', () => {
    expect(existsSync(join(ROOT, 'docs/data-pipeline.md'))).toBe(false)
    const sources = [
      ...['scripts', 'lib'].flatMap(dir => walk(dir, file => /\.(ts|tsx|mjs|cjs|py)$/.test(file))),
    ]
    expect(sources.filter(file => readFileSync(join(ROOT, file), 'utf8').includes('data-pipeline.md'))).toEqual([])
  })
})

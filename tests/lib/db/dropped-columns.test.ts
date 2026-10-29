import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Columns the 2026-10-29 database cleanup removes (migrations 20261029130000_cleanup.sql and ...140000_drop_name_copies.sql).
// A select that still names one fails with "column does not exist", and no type check sees a select string.
const DROPPED = [
  'obtaining_method', 'obtaining_method_en', 'obtaining_method_jp', 'corrosion_risk', 'first_appearance', 'last_ip', 'deck_code',
]

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === 'node_modules' || entry === '.next') continue
    if (statSync(path).isDirectory()) sources(path, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

const files = ['app', 'lib', 'components'].flatMap(dir => sources(dir))
const text = (file: string) => readFileSync(file, 'utf8')

describe('select strings after the database cleanup', () => {
  it('never name a removed column', () => {
    const hits = files.flatMap(file => {
      // select('…') / columns: '…' / template selects
      const strings = [...text(file).matchAll(/(?:select\(|columns:\s*|SELECT\w*\s*=\s*)[`'"]([^`'"]+)[`'"]/g)].map(match => match[1])
      return strings.filter(list => DROPPED.some(column => new RegExp(`(^|[\s,(])${column}([\s,)]|$)`).test(list))).map(list => `${file}: ${list.slice(0, 80)}`)
    })
    expect(hits).toEqual([])
  })

  it('read identities and E.G.O names from name_kr (the name copy column is gone)', () => {
    const hits = files.flatMap(file => {
      const source = text(file)
      return [...source.matchAll(/from\('(identities|ego)'\)\s*\.select\('([^']+)'/g)]
        .filter(match => /(^|[\s,])name([\s,]|$)/.test(match[2]))
        .map(match => `${file}: ${match[1]}`)
    })
    expect(hits).toEqual([])
  })
})

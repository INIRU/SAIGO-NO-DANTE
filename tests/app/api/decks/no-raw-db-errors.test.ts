import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? routeFiles(path) : name === 'route.ts' ? [path] : []
  })
}

describe('deck API responses carry no database error text', () => {
  it('no NextResponse.json body in app/api/decks holds an error message', () => {
    const offenders = routeFiles(join(process.cwd(), 'app/api/decks')).flatMap(file =>
      readFileSync(file, 'utf8').split('\n')
        .map((text, i) => ({ text, line: i + 1 }))
        .filter(({ text }) => /NextResponse\.json\(.*\bmessage\b/.test(text))
        .map(({ line }) => `${file}:${line}`))
    expect(offenders).toEqual([])
  })
})

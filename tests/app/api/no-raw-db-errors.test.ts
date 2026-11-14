import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const api = join(root, 'app/api')
const routes = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? routes(path) : name === 'route.ts' ? [path] : []
})

/** The text of every `NextResponse.json(...)` call in a source (balanced parentheses). */
function jsonCalls(source: string) {
  const calls: string[] = []
  for (let at = source.indexOf('NextResponse.json('); at >= 0; at = source.indexOf('NextResponse.json(', at + 1)) {
    let depth = 0, end = at
    for (let i = source.indexOf('(', at); i < source.length; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')' && --depth === 0) { end = i; break }
    }
    calls.push(source.slice(at, end + 1))
  }
  return calls
}

// A response body may not carry an exception or database error text: `x.message`, or a variable holding it (`message`).
// A zod validation message (`issues[0].message`) is for the user and stays.
const leaks = (call: string) => /[^\]]\.message\b/.test(call.replace(/issues\[0\]\.message/g, '')) || /(?:\berror:\s*|[{,]\s*)message\s*[,}\s]/.test(call)

it('no API route puts a database or exception message in a response body', () => {
  const hits = routes(api).flatMap(file => jsonCalls(readFileSync(file, 'utf8')).filter(leaks).map(call => `${relative(root, file)}: ${call.replace(/\s+/g, ' ')}`))
  expect(hits).toEqual([])
})

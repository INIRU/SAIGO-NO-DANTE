import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/** Every localFont({...}) call of a module: its variable, preload flag, src file and unicode-range. */
function fonts(path: string) {
  return read(path).split(/localFont\(\{/).slice(1).map(body => ({
    variable: body.match(/variable: '([^']+)'/)?.[1],
    preload: /preload: true/.test(body),
    src: body.match(/(?:src|path): '([^']+\.woff2)'/)?.[1],
    range: body.match(/prop: 'unicode-range', value: '([^']+)'/)?.[1],
  }))
}

function codes(range: string) {
  const out = new Set<number>()
  for (const part of range.split(',')) {
    const [a, b] = part.replace('U+', '').split('-').map(h => parseInt(h, 16))
    for (let c = a; c <= (b ?? a); c++) out.add(c)
  }
  return out
}

function ksX1001Syllables() {
  const decoder = new TextDecoder('euc-kr'), out = new Set<number>()
  for (let high = 0xb0; high <= 0xc8; high++) for (let low = 0xa1; low <= 0xfe; low++) {
    const c = decoder.decode(new Uint8Array([high, low])).codePointAt(0)!
    if (c >= 0xac00 && c <= 0xd7a3) out.add(c)
  }
  return out
}

const pretendard = fonts('app/pretendard.ts')
const hangul = pretendard.filter(f => /^--font-pretendard-hangul-\d+$/.test(f.variable ?? ''))

describe('REQ-SHARED-069 fonts are fetched by the pieces a page uses', () => {
  it('REQ-SHARED-069 preloads only the Latin piece, the first Hangul piece, KOTRA and Bebas', () => {
    const preloaded = [...pretendard, ...fonts('app/fonts.ts')].filter(f => f.preload).map(f => f.variable).sort()
    expect(preloaded).toEqual(['--font-bebas-kai', '--font-kotra-bold', '--font-pretendard-hangul-1', '--font-pretendard-latin'])
  })

  it('REQ-SHARED-069 splits the 2,350 common syllables into non-overlapping pieces, the first one small', () => {
    expect(hangul.length).toBeGreaterThanOrEqual(4)
    const seen = new Set<number>()
    for (const piece of hangul) for (const c of codes(piece.range!)) {
      expect(seen.has(c), `U+${c.toString(16)} is in two pieces`).toBe(false)
      seen.add(c)
    }
    for (const c of ksX1001Syllables()) expect(seen.has(c), `U+${c.toString(16)} has no piece`).toBe(true)
    const first = statSync(`app/${hangul[0].src}`).size
    expect(first).toBeLessThan(120 * 1024)
  })

  it('REQ-SHARED-069 puts every piece in the Pretendard family, the most frequent first', () => {
    const family = read('app/globals.css').match(/--font-pretendard: ([^;]+);/)![1]
    const order = family.split(',').map(s => s.trim().match(/--font-[\w-]+/)?.[0])
    expect(order).toEqual(['--font-pretendard-latin', ...hangul.map(f => f.variable), '--font-pretendard-symbols', '--font-pretendard-ext'])
  })

  it('REQ-SHARED-069 lets no installed Korean font or S-Core Dream draw body syllables before the Hangul pieces', () => {
    // A piece's `fallback` list is part of its family: a system Hangul font there wins over every later piece.
    for (const piece of pretendard.filter(f => f.variable !== '--font-heading-latin')) expect(read('app/pretendard.ts').split('localFont({').find(b => b.includes(`'${piece.variable}'`))).not.toMatch(/fallback: \[/)
    // A character missing from Pretendard (a Hanja) would download all of S-Core Dream for the body text.
    expect(read('app/globals.css').match(/--font-body: ([^;]+);/)![1]).not.toContain('--font-scdream')
  })
})

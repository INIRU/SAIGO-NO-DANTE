import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../..')

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const path = join(dir, name)
    return statSync(join(ROOT, path)).isDirectory() ? walk(path) : /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

describe('failed images leave only their frame', () => {
  it('no fallback component, placeholder drawings or pending text remain', () => {
    // A failed next/image with an empty alt draws nothing, so the gift slot or card face stays as it is.
    expect(existsSync(join(ROOT, 'components/ui/ImageWithFallback.tsx'))).toBe(false)
    expect(existsSync(join(ROOT, 'public/placeholders'))).toBe(false)
    const sources = ['app', 'components', 'lib', 'hooks'].flatMap(walk)
    expect(sources.filter(file => /ImageWithFallback|\/placeholders\//.test(read(file)))).toEqual([])
    for (const lang of ['ko', 'en', 'ja']) expect(read(`messages/${lang}.json`)).not.toContain('"imagePending"')
  })
})

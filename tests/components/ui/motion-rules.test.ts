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

const SOURCES = ['app', 'components', 'lib', 'hooks'].flatMap(walk)
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

describe('light motion', () => {
  it('no file imports the full motion component', () => {
    // `motion.div` bundles drag and layout animation, which the site does not use; `m.div` runs on the features LazyMotion provides.
    const full = SOURCES.filter(file => /import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]motion\/react['"]/.test(read(file)))
    expect(full).toEqual([])
  })

  it('the root layout provides LazyMotion (strict, domAnimation) through MotionProvider', () => {
    const provider = 'components/ui/MotionProvider.tsx'
    expect(existsSync(join(ROOT, provider))).toBe(true)
    const source = read(provider)
    expect(source).toMatch(/^'use client'/)
    // domAnimation, in its own chunk loaded after the page
    expect(source).toMatch(/<LazyMotion features=\{loadFeatures\} strict>/)
    expect(source).toMatch(/import\('\.\/motion-features'\)/)
    expect(read('components/ui/motion-features.ts')).toMatch(/import \{ domAnimation \} from 'motion\/react'[\s\S]*export default domAnimation/)
    expect(source).toMatch(/<MotionConfig reducedMotion="user">/)
    expect(read('app/[lang]/layout.tsx')).toMatch(/<MotionProvider>/)
  })

  it('no transition-all', () => {
    const all = SOURCES.filter(file => /transition-all|transition:\s*all\b/.test(read(file)))
    expect(all).toEqual([])
  })
})

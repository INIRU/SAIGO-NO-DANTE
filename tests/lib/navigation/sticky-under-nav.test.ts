import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isStuck } from '@/lib/navigation/sticky-under-nav'

const source = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8')

describe('bars that stick under the navbar', () => {
  it('REQ-SHARED-094 a bar is stuck while its layout place (without its slide) is at its sticky top', () => {
    expect(isStuck(64, 0, 64)).toBe(true)
    // slid up with the hidden navbar: the slide does not count
    expect(isStuck(0, -64, 64)).toBe(true)
    expect(isStuck(200, 0, 64)).toBe(false)
    expect(isStuck(136, -64, 64)).toBe(false)
  })

  it('REQ-SHARED-094 follows the navbar by sliding (transform), not by animating top, which lays out the page every frame', () => {
    const css = source('app/globals.css')
    const rule = css.match(/\.sticky-under-nav\{[^}]*\}/)![0]
    expect(rule).toContain('top:var(--nav-height)')
    expect(rule).toMatch(/transition:transform/)
    expect(rule).not.toMatch(/transition:top/)
    expect(css).toContain('html[data-nav-hidden] .sticky-under-nav[data-stuck]{transform:translateY(calc(-1 * var(--nav-height)))}')
    // the navbar marks the stuck bars as the page scrolls
    expect(source('components/layout/Navbar.tsx')).toContain('markStuckBars()')
    // a bar with its own top keeps it under the navbar's constant height
    expect(source('features/catalog/components/FilterSidebar.tsx')).toContain("top: 'calc(var(--nav-height) + 1rem)'")
  })
})

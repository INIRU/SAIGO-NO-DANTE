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
    expect(css).toContain('.sticky-under-nav{position:sticky;top:var(--nav-height)}')
    // .nav-slide: a sticky element with its own position and top that slides the same way
    expect(css).toContain(':is(.sticky-under-nav,.nav-slide){transition:transform 300ms')
    expect(css).toContain('html[data-nav-hidden] :is(.sticky-under-nav,.nav-slide)[data-stuck]{transform:translateY(calc(-1 * var(--nav-height)))}')
    expect(source('lib/navigation/sticky-under-nav.ts')).toContain("querySelectorAll<HTMLElement>('.sticky-under-nav, .nav-slide')")
    // the navbar marks the stuck bars as the page scrolls
    expect(source('components/layout/Navbar.tsx')).toContain('markStuckBars()')
    // a bar with its own top keeps it under the navbar's constant height
    expect(source('features/catalog/components/FilterSidebar.tsx')).toContain("top: 'calc(var(--nav-height) + 1rem)'")
  })

  it('REQ-SHARED-094 no sticky element animates its top: every one that follows the navbar slides instead', () => {
    const files = ['app/globals.css', 'features/tools/components/CalculatorArena.module.css', 'features/account/components/DocsTab.tsx',
      'features/account/components/PlaygroundTab.tsx', 'features/mirror-dungeon/components/GiftCatalog.tsx']
    for (const file of files) expect(source(file), file).not.toMatch(/transition:top|transition-\[top\]/)
    expect(source('app/globals.css')).toContain('top:calc(var(--nav-height) + 4.5rem)')
    expect(source('features/notes/components/NoteToc.tsx')).toContain('className="note-toc nav-slide"')
    expect(source('features/tools/components/CalculatorArena.module.css')).toContain('top:calc(var(--nav-height) + 1.5rem)')
    for (const file of ['features/tools/components/DamageCalculator.tsx', 'features/tools/components/ClashCalculator.tsx']) expect(source(file), file).toContain('nav-slide')
    expect(source('features/account/components/DocsTab.tsx')).toContain('xl:top-[var(--nav-height)]')
    expect(source('features/account/components/PlaygroundTab.tsx')).toContain('lg:top-[var(--nav-height)]')
    expect(source('features/planner/components/FloorTab.tsx')).toContain("'calc(var(--nav-height, 4rem) + var(--planner-bar-h, 0rem))'")
  })

  it('REQ-SHARED-094 the story map bus rides by transform, not by left and top', () => {
    expect(source('app/globals.css')).toContain('.story-bus { transition: transform .5s cubic-bezier(.22,1,.36,1); }')
    expect(source('app/[lang]/story/_components/StoryMap.tsx')).toMatch(/className="story-bus[^"]*"\s*style=\{\{ left: 0, top: 0, transform: `translate\(/)
  })
})

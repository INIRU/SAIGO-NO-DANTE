import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Bell } from 'lucide-react'
import Button, { buttonClass } from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'

const root = resolve(__dirname, '../../..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')
const filesWith = (dir: string, exts: string[]): string[] => readdirSync(join(root, dir)).flatMap(name => {
  const path = `${dir}/${name}`
  return statSync(join(root, path)).isDirectory() ? filesWith(path, exts) : exts.some(ext => path.endsWith(ext)) ? [path] : []
})
const tsxFiles = (dir: string) => filesWith(dir, ['.tsx'])

describe('shared Button', () => {
  it('renders each variant with a touch-size height, press feedback and a gold focus ring', () => {
    for (const variant of ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const) {
      const html = renderToStaticMarkup(<Button variant={variant}>저장</Button>)
      expect(html).toContain('type="button"')
      expect(html).toContain('min-h-11')
      expect(html).toContain('active:scale-[0.97]')
      expect(html).toContain('focus-visible:outline-[var(--gold)]')
      expect(html).not.toContain('transition-all')
    }
    expect(buttonClass({ variant: 'primary' })).toContain('bg-[var(--gold)]')
    expect(buttonClass({ size: 'sm' })).toContain('min-h-9')
  })

  it('keeps a disabled button\'s tooltip and hovers only when it can be pressed', () => {
    const html = renderToStaticMarkup(<Button disabled title="이유">복사</Button>)
    expect(html).toContain('title="이유"')
    expect(html).not.toContain('pointer-events-none')
    expect(buttonClass({ variant: 'primary' })).not.toMatch(/(^| )hover:/)
    expect(buttonClass({ variant: 'dangerSolid' })).toContain('bg-[var(--error)]')
  })

  it('marks a busy button disabled and aria-busy', () => {
    const html = renderToStaticMarkup(<Button loading>팔로우</Button>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
  })

  it('makes an icon-only button square and named', () => {
    const html = renderToStaticMarkup(<Button icon={Bell} aria-label="알림" />)
    expect(html).toContain('aria-label="알림"')
    expect(html).toContain('w-11')
  })
})

describe('shared Switch', () => {
  it('announces its state as a switch and moves the thumb with transform', () => {
    const on = renderToStaticMarkup(<Switch checked onChange={() => {}} label="알림" />)
    const off = renderToStaticMarkup(<Switch checked={false} onChange={() => {}} label="알림" disabled />)
    expect(on).toContain('role="switch"')
    expect(on).toContain('aria-checked="true"')
    expect(on).toContain('aria-label="알림"')
    expect(on).toContain('translate-x-5')
    expect(off).toContain('aria-checked="false"')
    expect(off).toContain('disabled=""')
    expect(on).not.toContain('transition-all')
    const small = renderToStaticMarkup(<Switch size="sm" checked onChange={() => {}} label="알림" />)
    expect(small).toContain('h-5 w-9')
    expect(small).toContain('translate-x-4')
  })
})

describe('shared Sheet', () => {
  it('is a BaseModal sheet with a fixed header and a scrolling body', () => {
    const sheet = source('components/ui/Sheet.tsx')
    expect(sheet).toContain("from './BaseModal'")
    expect(sheet).toMatch(/<BaseModal[^>]*\bsheet\b/)
    expect(sheet).toContain('overflow-y-auto')
  })

  it('replaces the hand-built mobile filter sheets', () => {
    for (const path of ['features/decks/components/DeckListFilters.tsx', 'app/[lang]/planner/community/CommunityClient.tsx', 'features/catalog/components/FilterSidebar.tsx']) {
      const file = source(path)
      expect(file, path).toContain("from '@/components/ui/Sheet'")
      expect(file, path).not.toContain('popup-drawer')
    }
  })
})

describe('one Switch everywhere', () => {
  it('keeps role="switch" inside the shared Switch only', () => {
    const offenders = [...tsxFiles('app'), ...tsxFiles('components')].filter(path => path !== 'components/ui/Switch.tsx' && source(path).includes('role="switch"'))
    expect(offenders).toEqual([])
  })

  it('has no screen-specific switch styles left', () => {
    const left: Record<string, RegExp> = {
      'features/tools/components/CollectionBoard.module.css': /\.switch\b/,
      'features/tools/components/random.module.css': /\.switch\b/,
      'features/motion/components/MotionDeck.module.css': /\.switch\b/,
      'features/tools/components/LunacyCalendar.module.css': /\.switch(Track|State)\b/,
      'features/account/components/support.css': /desk-switch/,
    }
    for (const [path, pattern] of Object.entries(left)) expect(source(path), path).not.toMatch(pattern)
    for (const path of ['app/[lang]/admin/maintenance/page.tsx', 'app/[lang]/admin/announcements/page.tsx', 'features/admin/components/admin.css']) expect(source(path), path).not.toContain('admin-switch')
  })
})

describe('shared DownloadModal', () => {
  it('is a BaseModal with shared Buttons, not a hand-built overlay', () => {
    const modal = source('features/account/components/DownloadModal.tsx')
    expect(modal).toContain("from '@/components/ui/BaseModal'")
    expect(modal).toContain("from '@/components/ui/Button'")
    expect(modal).not.toContain('fixed inset-0')
  })
})

describe('one Button family', () => {
  it('has no CompactButton file and no importer', () => {
    expect(existsSync(resolve(root, 'components/ui/CompactButton.tsx'))).toBe(false)
    const importers = [...tsxFiles('app'), ...tsxFiles('components')].filter(path => /\bCompactButton\b/.test(source(path)))
    expect(importers).toEqual([])
  })

  it('has no screen-specific button class left in tsx or css', () => {
    const pattern = /\b(community-button|community-icon-button|desk-button|admin-button|admin-icon-button)\b/
    const offenders = [...filesWith('app', ['.tsx', '.css']), ...filesWith('components', ['.tsx', '.css'])].filter(path => pattern.test(source(path)))
    expect(offenders).toEqual([])
  })
})

describe('design token colours', () => {
  const hexes = '0d0b08|1a1510|241c12|120e09|c8900a|e8b030|8a6010|3a2a15|e8dcc8|b0a890|8a8070|6a6058|c84040|4a9868'

  it('has no Tailwind arbitrary value written as a token hex in tsx/ts', () => {
    const pattern = new RegExp(`\\[#(${hexes})\\]`, 'i')
    const offenders = [...filesWith('app', ['.tsx', '.ts']), ...filesWith('components', ['.tsx', '.ts'])].filter(path => pattern.test(source(path)))
    expect(offenders).toEqual([])
  })

  it('has no token hex in css outside app/globals.css', () => {
    const pattern = new RegExp(`#(${hexes})\\b`, 'i')
    const offenders = [...filesWith('app', ['.css']), ...filesWith('components', ['.css']), ...filesWith('styles', ['.css'])]
      .filter(path => path !== 'app/globals.css' && pattern.test(source(path)))
    expect(offenders).toEqual([])
  })
})

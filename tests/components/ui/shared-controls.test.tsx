import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Bell } from 'lucide-react'
import Button, { buttonClass } from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'

const source = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8')

describe('shared Button', () => {
  it('REQ-SHARED-056 renders each variant with a touch-size height, press feedback and a gold focus ring', () => {
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

  it('REQ-SHARED-056 marks a busy button disabled and aria-busy', () => {
    const html = renderToStaticMarkup(<Button loading>팔로우</Button>)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
  })

  it('REQ-SHARED-056 makes an icon-only button square and named', () => {
    const html = renderToStaticMarkup(<Button icon={Bell} aria-label="알림" />)
    expect(html).toContain('aria-label="알림"')
    expect(html).toContain('w-11')
  })
})

describe('shared Switch', () => {
  it('REQ-SHARED-057 announces its state as a switch and moves the thumb with transform', () => {
    const on = renderToStaticMarkup(<Switch checked onChange={() => {}} label="알림" />)
    const off = renderToStaticMarkup(<Switch checked={false} onChange={() => {}} label="알림" disabled />)
    expect(on).toContain('role="switch"')
    expect(on).toContain('aria-checked="true"')
    expect(on).toContain('aria-label="알림"')
    expect(on).toContain('translate-x-5')
    expect(off).toContain('aria-checked="false"')
    expect(off).toContain('disabled=""')
    expect(on).not.toContain('transition-all')
  })
})

describe('shared Sheet', () => {
  it('REQ-SHARED-058 is a BaseModal sheet with a fixed header and a scrolling body', () => {
    const sheet = source('components/ui/Sheet.tsx')
    expect(sheet).toContain("from './BaseModal'")
    expect(sheet).toMatch(/<BaseModal[^>]*\bsheet\b/)
    expect(sheet).toContain('overflow-y-auto')
  })

  it('REQ-SHARED-058 replaces the hand-built mobile filter sheets', () => {
    for (const path of ['components/decks/DeckListFilters.tsx', 'app/[lang]/planner/community/CommunityClient.tsx', 'components/browser/FilterSidebar.tsx']) {
      const file = source(path)
      expect(file, path).toContain("from '@/components/ui/Sheet'")
      expect(file, path).not.toContain('popup-drawer')
    }
  })
})

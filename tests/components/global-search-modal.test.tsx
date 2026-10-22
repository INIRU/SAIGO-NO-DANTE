import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))
vi.mock('@/hooks/useSearchIndex', () => ({ useSearchIndex: () => ({ entries: [], failed: false, retry: () => {} }), loadSearchIndex: vi.fn() }))

import SearchModal, { ResultRow } from '@/components/ui/SearchModal'
import type { Hit } from '@/lib/search/engine'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

const row = (hit: Hit) => renderToStaticMarkup(<ResultRow hit={hit} id="r0" active={false} onChoose={() => {}} onHover={() => {}} />)
const ego = { type: 'ego' as const, href: '/e/1', label: '적안', names: { ko: '적안', en: 'Red Eyes' } }

describe('global search modal', () => {
  it('empty state offers sinner shortcuts, no explanatory sentence (REQ-SHARED-053)', () => {
    const html = renderToStaticMarkup(<SearchModal open onClose={() => {}} />)
    expect(html.match(/href="\/ko\/sinners\/[a-z-]+"/g)).toHaveLength(12)
    expect(html).not.toContain('emptyPromptDescription')
  })
  it('exposes combobox semantics', () => {
    const html = renderToStaticMarkup(<SearchModal open onClose={() => {}} />)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('role="listbox"')
  })
  it('marks the matched letters of the label (REQ-SHARED-051)', () => {
    const html = row({ entry: ego, score: 1, reasons: [{ field: 'label', text: '적안', ranges: [[0, 1]] }] })
    expect(html).toMatch(/<mark[^>]*>적<\/mark>안/)
    expect(html).not.toContain('reasons.')
  })
  it('names the field and marks it when another name matched (REQ-SHARED-051)', () => {
    const html = row({ entry: ego, score: 1, reasons: [{ field: 'en', text: 'Red Eyes', ranges: [[0, 7]] }] })
    expect(html).toContain('reasons.en')
    expect(html).toMatch(/<mark[^>]*>Red Eye<\/mark>s/)
  })
  it('has every label in every locale', () => {
    for (const m of [ko, en, ja]) {
      const s = m.globalSearch as Record<string, unknown> & { types: Record<string, string>; reasons: Record<string, string> }
      for (const t of ['all', 'sinner', 'identity', 'ego', 'keyword', 'egoGift', 'themePack', 'event', 'page']) expect(s.types[t], t).toBeTruthy()
      for (const r of ['ko', 'en', 'ja', 'sinner', 'keyword', 'alias', 'fuzzy']) expect(s.reasons[r], r).toBeTruthy()
      expect(s).not.toHaveProperty('emptyPromptDescription')
      expect(s).not.toHaveProperty('noResultsDescription')
    }
  })
})

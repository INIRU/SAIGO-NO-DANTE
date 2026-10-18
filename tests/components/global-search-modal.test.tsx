import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))

import SearchModal from '@/components/ui/SearchModal'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

describe('global search modal', () => {
  it('empty state shows only a title, no explanatory sentence', () => {
    const html = renderToStaticMarkup(<SearchModal open onClose={() => {}} />)
    expect(html).toContain('emptyPromptTitle')
    expect(html).not.toContain('emptyPromptDescription')
  })
  it('has no explanatory description keys left in any locale', () => {
    for (const m of [ko, en, ja]) {
      expect(m.globalSearch).not.toHaveProperty('emptyPromptDescription')
      expect(m.globalSearch).not.toHaveProperty('noResultsDescription')
    }
  })
  it('exposes combobox semantics', () => {
    const html = renderToStaticMarkup(<SearchModal open onClose={() => {}} />)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('role="listbox"')
  })
})

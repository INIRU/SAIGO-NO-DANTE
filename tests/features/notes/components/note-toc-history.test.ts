import { afterEach, expect, it, vi } from 'vitest'
import { jumpToHeading } from '@/features/notes/components/NoteToc'

afterEach(() => vi.unstubAllGlobals())

it('REQ-COMMUNITY-057 a contents link scrolls to its heading and swaps the address, leaving no back-button step', () => {
  const scrollIntoView = vi.fn()
  const replaceState = vi.fn(), pushState = vi.fn()
  vi.stubGlobal('document', { getElementById: (id: string) => id === 'note-a' ? { scrollIntoView } : null })
  vi.stubGlobal('window', { location: { href: 'https://saigo-no-dante.com/ko/decks/1' }, history: { state: { keep: 1 }, replaceState, pushState }, matchMedia: () => ({ matches: false }) })
  jumpToHeading('note-a')
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  expect(replaceState).toHaveBeenCalledWith({ keep: 1 }, '', 'https://saigo-no-dante.com/ko/decks/1#note-a')
  expect(pushState).not.toHaveBeenCalled()
})

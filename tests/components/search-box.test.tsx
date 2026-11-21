import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />, getImageProps: ({ src, alt }: { src: string; alt: string }) => ({ props: { src, alt } }) }))

import SearchBox, { SuggestCut, SuggestPanel, SuggestRow, nameMarks, searchBoxKey } from '@/components/ui/SearchBox'
import type { Hit } from '@/lib/search/engine'

const groups = [
  { title: '기프트', rows: [{ key: 'a', body: <SuggestRow name="불꽃 깃털" right="화상" />, onPick: () => {} }, { key: 'b', body: <SuggestRow name="화염병" />, onPick: () => {} }] },
  { title: '효과', rows: [{ key: 'c', body: <SuggestCut name="재" before="…적에게 " hit="화상" after=" 부여" />, onPick: () => {} }] },
]

describe('SearchBox markup', () => {
  it('is a closed combobox until it is typed into', () => {
    const html = renderToStaticMarkup(<SearchBox value="화" onChange={() => {}} label="기프트 검색" clearLabel="지우기" groups={groups} />)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('type="search"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).toContain('aria-label="기프트 검색"')
    expect(html).toContain('aria-label="지우기"')
    expect(html).not.toContain('role="listbox"')
  })

  it('shows no clear button for an empty value', () => {
    const html = renderToStaticMarkup(<SearchBox value="" onChange={() => {}} label="검색" clearLabel="지우기" groups={groups} />)
    expect(html).not.toContain('aria-label="지우기"')
  })
})

describe('SuggestPanel markup', () => {
  const html = renderToStaticMarkup(<SuggestPanel id="p" label="기프트 검색" groups={groups} active={1} onHover={() => {}} onPick={() => {}} />)

  it('is a listbox of options in named groups, and the group titles are not options', () => {
    expect(html).toContain('role="listbox"')
    expect([...html.matchAll(/role="option"/g)]).toHaveLength(3)
    expect([...html.matchAll(/role="group"/g)]).toHaveLength(2)
    expect(html).toMatch(/id="p-title-0"[^>]*>기프트</)
    expect(html).not.toMatch(/role="option"[^>]*>기프트</)
  })

  it('numbers the options across groups and selects only the active one', () => {
    expect(html).toContain('id="p-0"')
    expect(html).toContain('id="p-2"')
    expect([...html.matchAll(/aria-selected="true"/g)]).toHaveLength(1)
    expect(html).toMatch(/id="p-1"[^>]*aria-selected="true"/)
  })
})

describe('suggestion rows', () => {
  it('marks the matched letters of a name and the matched part of a text cut', () => {
    const row = renderToStaticMarkup(<SuggestRow name="불꽃 깃털" marks={[[3, 5]]} />)
    expect(row).toContain('불꽃 <mark>깃털</mark>')
    const cut = renderToStaticMarkup(<SuggestCut name="재" before="…적에게 " hit="화상" after=" 부여" />)
    expect(cut).toContain('…적에게 <mark>화상</mark> 부여')
  })

  it('takes the marks from the reason that matched the displayed name only', () => {
    const entry = { type: 'egoGift' as const, href: '1', label: '불꽃 깃털', names: { en: 'Flame Feather' } }
    const named = { entry, reasons: [{ field: 'label' as const, text: '불꽃 깃털', ranges: [[0, 2]] as [number, number][]}] } as Hit
    const other = { entry, reasons: [{ field: 'en' as const, text: 'Flame Feather', ranges: [[0, 5]] as [number, number][]}] } as Hit
    expect(nameMarks(named)).toEqual([[0, 2]])
    expect(nameMarks(other)).toEqual([])
  })
})

describe('searchBoxKey', () => {
  const state = (open: boolean, active: number, count = 3) => ({ open, active, count })

  it('moves down and up through the rows and wraps at both ends', () => {
    expect(searchBoxKey(state(true, -1), 'ArrowDown', false)).toEqual({ open: true, active: 0 })
    expect(searchBoxKey(state(true, 0), 'ArrowDown', false)).toEqual({ open: true, active: 1 })
    expect(searchBoxKey(state(true, 2), 'ArrowDown', false)).toEqual({ open: true, active: 0 })
    expect(searchBoxKey(state(true, 1), 'ArrowUp', false)).toEqual({ open: true, active: 0 })
    expect(searchBoxKey(state(true, 0), 'ArrowUp', false)).toEqual({ open: true, active: 2 })
    expect(searchBoxKey(state(true, -1), 'ArrowUp', false)).toEqual({ open: true, active: 2 })
  })

  it('reopens a closed panel with an arrow key', () => {
    expect(searchBoxKey(state(false, -1), 'ArrowDown', false)).toEqual({ open: true, active: 0 })
    expect(searchBoxKey(state(false, -1), 'ArrowUp', false)).toEqual({ open: true, active: 2 })
  })

  it('picks the active row with Enter and leaves Enter alone when there is none', () => {
    expect(searchBoxKey(state(true, 1), 'Enter', false)).toEqual({ open: false, active: -1, pick: true })
    expect(searchBoxKey(state(true, -1), 'Enter', false)).toBeNull()
    expect(searchBoxKey(state(false, 1), 'Enter', false)).toBeNull()
  })

  it('closes with Escape, and has nothing to close when the panel is shut', () => {
    expect(searchBoxKey(state(true, 1), 'Escape', false)).toEqual({ open: false, active: -1 })
    expect(searchBoxKey(state(false, -1), 'Escape', false)).toBeNull()
  })

  it('ignores every key while an IME composition is in progress', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) expect(searchBoxKey(state(true, 1), key, true)).toBeNull()
  })

  it('leaves Tab, typing and an empty panel alone', () => {
    expect(searchBoxKey(state(true, 1), 'Tab', false)).toBeNull()
    expect(searchBoxKey(state(true, 1), 'a', false)).toBeNull()
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) expect(searchBoxKey(state(true, -1, 0), key, false)).toBeNull()
  })
})

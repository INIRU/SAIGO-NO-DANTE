import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EgoGift } from '@/features/mirror-dungeon/types'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => [namespace, key].filter(Boolean).join('.') + (values ? JSON.stringify(values) : ''),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

import { GiftPresetPanel } from '@/features/mirror-dungeon/components/GiftPresetModal'
import { GIFT_PRESET_GROUP_LIMIT, type GiftPreset } from '@/features/mirror-dungeon/lib/gift-presets'

const gift = (game_id: number) => ({ id: `uuid-${game_id}`, game_id, name: `기프트${game_id}`, keyword: '공통', grade: '1', is_synthesis: false, image_url: null }) as EgoGift
const gifts = [gift(1), gift(2), gift(3)]
const preset: GiftPreset = { id: 's1', name: '화상 덱', groups: [{ name: '최우선 먹기', gifts: ['3', '1'], memo: '2층 전에 먹기' }, { name: '', gifts: ['2'], memo: '' }] }
const panel = (props: Partial<React.ComponentProps<typeof GiftPresetPanel>> = {}) =>
  renderToStaticMarkup(<GiftPresetPanel preset={preset} gifts={gifts} selected={0} onSelect={() => {}} onChange={() => {}} onRemoveGroup={() => {}} held={null} over={null} actions={null} {...props} />)
const groupHtml = (html: string) => html.split(/(?=<section[^>]*data-preset-group=)/).slice(1)

describe('REQ-MIRROR-DUNGEON-020 preset editor panel', () => {
  it('REQ-MIRROR-DUNGEON-020 names the preset on top and gives each group a name, its gifts in order, a memo and a trash button', () => {
    const html = panel()
    expect(html).toMatch(/<input[^>]*maxLength="20"[^>]*aria-label="mirrorDungeonPage\.presetName"[^>]*value="화상 덱"/)
    expect(html.indexOf('value="화상 덱"')).toBeLessThan(html.indexOf('data-preset-group'))
    const [first, second] = groupHtml(html)
    expect(first).toMatch(/<input[^>]*maxLength="20"[^>]*value="최우선 먹기"/)
    expect([...first.matchAll(/data-preset-chip="([^"]+)"/g)].map(m => m[1])).toEqual(['3', '1'])
    expect([...first.matchAll(/data-gift-id="([^"]+)"/g)].map(m => m[1])).toEqual(['uuid-3', 'uuid-1'])
    expect(first).toMatch(/<textarea[^>]*maxLength="100"[^>]*>2층 전에 먹기<\/textarea>/)
    // The second group has no name of its own: it goes by its number.
    expect(second).toContain('aria-label="mirrorDungeonPage.presetGroupNumbered{&quot;number&quot;:2}"')
    expect(second).toMatch(/<button[^>]*aria-label="mirrorDungeonPage\.presetGroupDelete[^"]*"[^>]*><svg/)
    // The whole count sits beside the name.
    expect(html).toMatch(/>3<\/span><span[^>]*>\/60</)
  })

  it('REQ-MIRROR-DUNGEON-020 marks the chosen group and shows only that group below the two-column width', () => {
    const [first, second] = groupHtml(panel({ selected: 1 }))
    expect(first).toMatch(/<button[^>]*aria-pressed="false"[^>]*aria-label="mirrorDungeonPage\.presetGroupSelect/)
    expect(second).toMatch(/<button[^>]*aria-pressed="true"[^>]*aria-label="mirrorDungeonPage\.presetGroupSelect/)
    expect(first.slice(0, first.indexOf('>'))).toContain('max-lg:hidden')
    expect(second.slice(0, second.indexOf('>'))).not.toContain('max-lg:hidden')
  })

  it('REQ-MIRROR-DUNGEON-020 offers one more group until there are six', () => {
    // The opening tag of the button that ends with the "add a group" text.
    const add = (html: string) => { const end = html.indexOf('mirrorDungeonPage.presetGroupAdd</button>'); return html.slice(html.lastIndexOf('<button', end), html.indexOf('>', html.lastIndexOf('<button', end))) }
    expect(add(panel())).toContain('<button')
    expect(add(panel())).not.toContain('disabled=""')
    const full = { ...preset, groups: Array.from({ length: GIFT_PRESET_GROUP_LIMIT }, () => ({ name: '', gifts: [], memo: '' })) }
    expect(add(panel({ preset: full }))).toContain('disabled=""')
  })

  it('REQ-MIRROR-DUNGEON-020 dims the gift being dragged and marks where it would land', () => {
    const html = panel({ held: { key: '3', from: 0 }, over: { group: 1, before: '2' } })
    const [first, second] = groupHtml(html)
    expect(first).toMatch(/<li[^>]*data-preset-chip="3"[^>]*opacity-40/)
    expect(second).toMatch(/data-preset-chip="2"[^>]*><span[^>]*data-drop-mark/)
    expect(first).not.toContain('data-drop-mark')
    expect(panel()).not.toContain('data-drop-mark')
  })
})

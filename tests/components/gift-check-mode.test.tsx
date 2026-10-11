import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EgoGift, EgoGiftTheme } from '@/components/mirror-dungeon/types'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => [namespace, key].filter(Boolean).join('.') + (values ? JSON.stringify(values) : ''),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

import GiftCatalog, { useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import { GiftWarningMark } from '@/components/ui/GiftCard'
import GiftTab from '@/components/mirror-dungeon/GiftTab'

const gift = (game_id: number, keyword: string, extra: Partial<EgoGift> = {}) => ({ id: `uuid-${game_id}`, game_id, name: `기프트${game_id}`, keyword, grade: '1', is_synthesis: false, image_url: null, ...extra }) as EgoGift
const gifts = [gift(1, '공통'), gift(2, '파열', { is_synthesis: true }), gift(3, '화상')]
// An id without a composed poster (lib/data/theme-pack-visuals), so the mark shows the pack's own image_url.
const themes = [{ id: 999001, name: '전용 팩', ego_gift_ids: [1], specific_ego_gift_ids: [3], fixed_reward_gift_ids: null, image_url: 'https://example.test/pack-1001.webp' } as EgoGiftTheme]
const icon = () => null
const root = resolve(__dirname, '../..')

function Catalog(props: Partial<React.ComponentProps<typeof GiftCatalog>>) {
  return <GiftCatalog gifts={gifts} getGiftKeywordIcon={icon} filters={useGiftCatalogFilters()} onGiftClick={() => {}} {...props} />
}
function Tab({ checkMode }: { checkMode: boolean }) {
  return <GiftTab {...useGiftCatalogFilters()} gifts={gifts} themes={themes} getGiftKeywordIcon={icon} recipes={[]}
    onSelectGift={() => {}} checkMode={checkMode} onCheckModeChange={() => {}} />
}
const sectionLabels = (html: string) => [...html.matchAll(/<section[^>]*aria-label="([^"]+)"/g)].map(m => m[1])

describe('REQ-MIRROR-DUNGEON-017 the catalog follows the chosen keyword order', () => {
  it('REQ-MIRROR-DUNGEON-017 lists keyword tabs and keyword groups in the given order', () => {
    expect(sectionLabels(renderToStaticMarkup(<Catalog />))).toEqual(['공통', '화상', '파열'])
    const html = renderToStaticMarkup(<Catalog keywordOrder={['파열', '공통', '화상', '출혈', '진동', '침잠', '호흡', '충전', '참격', '관통', '타격']} />)
    expect(sectionLabels(html)).toEqual(['파열', '공통', '화상'])
    const tabs = [...html.matchAll(/<button type="button" aria-pressed="[^"]+"[^>]*>(?:<img[^>]*>)?([^<]+)/g)].map(m => m[1])
    expect(tabs.slice(0, 4)).toEqual(['전체', '파열', '공통', '화상'])
  })
})

describe('REQ-MIRROR-DUNGEON-015 check mode', () => {
  it('REQ-MIRROR-DUNGEON-015 an obtained gift is dimmed and can still be pressed', () => {
    const html = renderToStaticMarkup(<Catalog markedIds={new Set(['uuid-1'])} markedLabel="획득" />)
    const at = html.indexOf('aria-label="기프트1, 획득"')
    const obtained = html.slice(at - 200, at + 400)
    expect(obtained).toContain('opacity:0.35')
    expect(obtained).not.toMatch(/<button[^>]*disabled=""/)
  })

  it('REQ-MIRROR-DUNGEON-015 shows the check tools only in check mode', () => {
    const off = renderToStaticMarkup(<Tab checkMode={false} />)
    expect(off).toContain('mirrorDungeonPage.checkMode')
    expect(off).not.toContain('mirrorDungeonPage.checkReset')
    const on = renderToStaticMarkup(<Tab checkMode />)
    for (const key of ['checkReset', 'checkExit', 'checked']) expect(on).toContain(`mirrorDungeonPage.${key}`)
  })

  it('REQ-MIRROR-DUNGEON-015 hides the navigation and footer and frees the space under the navigation', () => {
    const workspaces = readFileSync(resolve(root, 'styles/globals/workspaces.css'), 'utf8')
    expect(workspaces).toMatch(/html\[data-with-gift-check\] :is\(\.site-navigation, \.site-footer\) \{ display: none; \}/)
    const globals = readFileSync(resolve(root, 'app/globals.css'), 'utf8')
    expect(globals).toMatch(/html:is\([^)]*\[data-with-gift-check\][^)]*\)\{--nav-offset:0rem\}/)
  })
})

describe('REQ-MIRROR-DUNGEON-018 gift presets', () => {
  it('REQ-MIRROR-DUNGEON-018 offers the preset choice only in check mode', () => {
    expect(renderToStaticMarkup(<Tab checkMode />)).toContain('mirrorDungeonPage.preset')
    expect(renderToStaticMarkup(<Tab checkMode={false} />)).not.toContain('mirrorDungeonPage.preset')
  })

  it('REQ-MIRROR-DUNGEON-018 groups a preset by keyword and keeps the order its gifts were added inside each group', () => {
    const names = (html: string) => [...html.matchAll(/class="gift-card[^"]*" aria-label="([^"]+)"/g)].map(m => m[1])
    // Added in this order: a grade-3 burn gift, a rupture gift, a grade-1 burn gift, a common gift.
    const added = [gift(4, '화상', { grade: '3' }), gifts[1], gift(5, '화상', { grade: '1' }), gifts[0]]
    // The plain list sorts each keyword by grade.
    expect(names(renderToStaticMarkup(<Catalog gifts={added} />))).toEqual(['기프트1', '기프트5', '기프트4', '기프트2'])
    const html = renderToStaticMarkup(<Catalog gifts={added} keepOrder />)
    expect(sectionLabels(html)).toEqual(['공통', '화상', '파열'])
    expect(names(html)).toEqual(['기프트1', '기프트4', '기프트5', '기프트2'])
    // Sorting by name or grade would undo the added order.
    expect(html).not.toContain('aria-label="mirrorDungeonPage.sort"')
  })
})

describe('REQ-MIRROR-DUNGEON-016 fusion and pack-only marks', () => {
  it('REQ-MIRROR-DUNGEON-016 the fusion triangle is yellow, the planner one stays red', () => {
    const red = renderToStaticMarkup(<GiftWarningMark label="이 층" />)
    const yellow = renderToStaticMarkup(<GiftWarningMark label="합성" tone="yellow" />)
    expect(red).toContain('#bd2430')
    expect(yellow).not.toContain('#bd2430')
    expect(yellow).toContain('#e8b030')
  })

  it('REQ-MIRROR-DUNGEON-016 check mode marks fusion gifts and pack-only gifts, the plain list does not', () => {
    const on = renderToStaticMarkup(<Tab checkMode />)
    expect(on.match(/data-gift-warning/g)).toHaveLength(1)
    expect(on).toContain('https://example.test/pack-1001.webp')
    const off = renderToStaticMarkup(<Tab checkMode={false} />)
    expect(off).not.toContain('data-gift-warning')
    expect(off).not.toContain('pack-1001.webp')
  })
})

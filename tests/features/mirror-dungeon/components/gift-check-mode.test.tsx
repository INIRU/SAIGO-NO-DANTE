import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EgoGift, EgoGiftTheme } from '@/features/mirror-dungeon/types'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => [namespace, key].filter(Boolean).join('.') + (values ? JSON.stringify(values) : ''),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />, getImageProps: ({ src, alt }: { src: string; alt: string }) => ({ props: { src, alt } }) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated' }) }))
// The stored presets; empty unless a test chooses one.
const stored = vi.hoisted(() => ({ presets: { active: null as string | null, list: [] as { id: string; name: string; groups: { name: string; gifts: string[]; memo: string }[] }[] } }))
vi.mock('@/features/mirror-dungeon/hooks/useGiftPresets', () => ({ useGiftPresets: () => [stored.presets, () => {}] }))

import GiftCatalog, { useGiftCatalogFilters } from '@/features/mirror-dungeon/components/GiftCatalog'
import { GiftWarningMark } from '@/features/mirror-dungeon/components/GiftCard'
import GiftTab from '@/features/mirror-dungeon/components/GiftTab'
import GiftCheckWindow from '@/features/mirror-dungeon/components/GiftCheckWindow'

const gift = (game_id: number, keyword: string, extra: Partial<EgoGift> = {}) => ({ id: `uuid-${game_id}`, game_id, name: `기프트${game_id}`, keyword, grade: '1', is_synthesis: false, image_url: null, ...extra }) as EgoGift
const gifts = [gift(1, '공통'), gift(2, '파열', { is_synthesis: true }), gift(3, '화상')]
// An id without a composed poster (lib/data/theme-pack-visuals), so the mark shows the pack's own image_url.
const themes = [{ id: 999001, name: '전용 팩', ego_gift_ids: [1], specific_ego_gift_ids: [3], fixed_reward_gift_ids: null, image_url: 'https://example.test/pack-1001.webp' } as EgoGiftTheme]
const icon = () => null
const root = resolve(__dirname, '../../../..')

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
  it('REQ-MIRROR-DUNGEON-018 REQ-MIRROR-DUNGEON-020 keeps the preset button in the toolbar outside check mode too', () => {
    const button = /<button[^>]*>(?:<svg[\s\S]*?<\/svg>)?<span[^>]*>mirrorDungeonPage\.preset<\/span><\/button>/
    expect(renderToStaticMarkup(<Tab checkMode={false} />)).toMatch(button)
    expect(renderToStaticMarkup(<Tab checkMode />)).toMatch(button)
  })

  it('REQ-MIRROR-DUNGEON-018 lists a preset by group, in the order its gifts were placed, with the memo under the group name', () => {
    const names = (html: string) => [...html.matchAll(/class="gift-card[^"]*" aria-label="([^"]+)"/g)].map(m => m[1])
    // Placed in this order: a grade-3 burn gift and a common gift in the first group, a rupture gift and a grade-1 burn gift in the second.
    const first = [gift(4, '화상', { grade: '3' }), gifts[0]], second = [gifts[1], gift(5, '화상', { grade: '1' })]
    const placed = [...first, ...second]
    // The plain list sorts by keyword, then grade.
    expect(names(renderToStaticMarkup(<Catalog gifts={placed} />))).toEqual(['기프트1', '기프트5', '기프트4', '기프트2'])
    const html = renderToStaticMarkup(<Catalog gifts={placed} keepOrder pinned={[
      { ids: new Set(first.map(item => item.id)), label: '최우선 먹기', note: '2층 전에 먹기' },
      { ids: new Set(second.map(item => item.id)), label: '묶음 2' },
    ]} />)
    expect(sectionLabels(html)).toEqual(['최우선 먹기', '묶음 2'])
    expect(names(html)).toEqual(['기프트4', '기프트1', '기프트2', '기프트5'])
    expect(html).toMatch(/최우선 먹기<\/span>[\s\S]*?<\/h2><p[^>]*>2층 전에 먹기<\/p>/)
    expect(html.match(/<\/h2><p/g)).toHaveLength(1)
    // Sorting by name or grade would undo the placed order.
    expect(html).not.toContain('aria-label="mirrorDungeonPage.sort"')
  })

  it('REQ-MIRROR-DUNGEON-020 every catalog cell names its gift, so a held cell is known without a handler on each cell', () => {
    const html = renderToStaticMarkup(<Catalog />)
    expect([...html.matchAll(/data-gift-id="([^"]+)"/g)].map(m => m[1])).toEqual(['uuid-1', 'uuid-3', 'uuid-2'])
  })
})

describe('REQ-MIRROR-DUNGEON-023 the chosen preset in a small window', () => {
  const button = 'aria-label="mirrorDungeonPage.checkPip"'

  it('REQ-MIRROR-DUNGEON-023 check mode offers the window only while a preset with gifts is chosen', () => {
    expect(renderToStaticMarkup(<Tab checkMode />)).not.toContain(button)
    stored.presets = { active: 'p1', list: [{ id: 'p1', name: '화상 덱', groups: [{ name: '최우선 먹기', gifts: ['1', '3'], memo: '2층 전에' }] }] }
    try {
      expect(renderToStaticMarkup(<Tab checkMode />)).toContain(button)
      expect(renderToStaticMarkup(<Tab checkMode={false} />)).not.toContain(button)
    } finally {
      stored.presets = { active: null, list: [] }
    }
  })

  it('REQ-MIRROR-DUNGEON-023 the window lists the groups with their memo, marks obtained gifts and counts them', () => {
    const html = renderToStaticMarkup(<GiftCheckWindow title="화상 덱" checkedLabel="획득" checkedIds={new Set(['uuid-1'])} onCheck={() => {}} marks={new Map()}
      sections={[{ label: '최우선 먹기', note: '2층 전에', gifts: [gifts[0], gifts[2]] }, { label: '묶음 2', gifts: [gifts[1]] }]} />)
    expect(sectionLabels(html)).toEqual(['최우선 먹기', '묶음 2'])
    expect([...html.matchAll(/data-gift-id="([^"]+)"/g)].map(m => m[1])).toEqual(['uuid-1', 'uuid-3', 'uuid-2'])
    expect(html).toMatch(/최우선 먹기<\/span>[\s\S]*?<\/h2><p[^>]*>2층 전에<\/p>/)
    expect(html).toContain('aria-label="기프트1, 획득"')
    expect(html).toContain('화상 덱')
    expect(html).toMatch(/획득[\s\S]*?1 \/ 3/)
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

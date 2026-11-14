import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />, getImageProps: ({ src, alt }: { src: string; alt: string }) => ({ props: { src, alt } }) }))

import FloorConstraints from '@/features/planner/components/FloorConstraints'
import { ReadOnlyBlessingGrid } from '@/features/planner/components/BlessingGrid'
import type { Blessing } from '@/features/planner/lib/blessing'
import palette from '@/lib/generated/season-palette.json'
import { constraintsForFloor } from '@/lib/planner/constraints'
import { samplePalettes } from '@/scripts/assets/season-palette.mjs'

const root = resolve(__dirname, '../../../..')
const blessing: Blessing = { baseId: 100, name: '시작의 별', costs: [10, 20, 30], effectsByLevel: [['시작 코스트 +150'], [], []] }

describe('season tiles', () => {
  it('takes the phone tiles\' colours from the season\'s own card art, sampled at build time', async () => {
    // the build samples the cards again, so a new season's art is all a season change needs
    expect(readFileSync(resolve(root, 'package.json'), 'utf8')).toMatch(/"build": "node scripts\/assets\/season-palette\.mjs && /)
    expect(await samplePalettes()).toEqual(palette)
    for (const kind of ['blessing', 'constraint'] as const)
      for (const key of ['top', 'bottom', 'border'] as const) expect(palette[kind][key]).toMatch(/^#[0-9a-f]{6}$/)
    const html = renderToStaticMarkup(<ReadOnlyBlessingGrid blessings={[blessing]} selectedBlessings={new Map([[100, 1]])} emptyText="" />)
    expect(html).toContain(`linear-gradient(180deg, ${palette.blessing.top} 0%, ${palette.blessing.bottom} 100%)`)
    expect(html).not.toContain('#3a1210')
    // the card art carries no season in its name: the next season replaces the files only
    expect(readFileSync(resolve(root, 'features/planner/components/BlessingTab.tsx'), 'utf8')).not.toContain('sisyphus')
  })

  it('picks constraints on a phone from small name tiles, like the blessing tiles, the picked ones filled', () => {
    const html = renderToStaticMarkup(<FloorConstraints floor={11} entries={[{ floor: 11, constraints: [] }]} onChange={() => {}} />)
    const tiles = html.match(/<ul[^>]*data-constraint-tiles[^>]*class="[^"]*sm:hidden[\s\S]*?<\/ul>/)?.[0] ?? ''
    expect(tiles).toMatch(/<button[^>]*aria-pressed="false"[\s\S]*레벨 강화/)
    // the big game cards stay for wider screens
    expect(html).toMatch(/class="hidden sm:grid/)
    const first = constraintsForFloor(11, [])[0].id
    const picked = renderToStaticMarkup(<FloorConstraints floor={11} entries={[{ floor: 11, constraints: [first] }]} onChange={() => {}} />)
    expect(picked).toMatch(/<button[^>]*aria-pressed="true"[^>]*style="background:linear-gradient\(180deg, #[0-9a-f]{6} 0%, #[0-9a-f]{6} 100%\)/)
    // a read-only plan keeps its score chips
    const readOnly = renderToStaticMarkup(<FloorConstraints floor={11} entries={[{ floor: 11, constraints: [first] }]} />)
    expect(readOnly).not.toContain('data-constraint-tiles')
  })
})

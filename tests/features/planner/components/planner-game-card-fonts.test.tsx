import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) => <img src={src} alt={alt} style={style} />, getImageProps: ({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) => ({ props: { src, alt, style } }) }))

import FloorConstraints from '@/features/planner/components/FloorConstraints'
import { ReadOnlyBlessingGrid } from '@/features/planner/components/BlessingGrid'
import type { Blessing } from '@/features/planner/lib/blessing'

const blessing: Blessing = { baseId: 100, name: '시작의 별', costs: [10, 20, 30], effectsByLevel: [['시작 <k>코스트</k> +150'], [], []] }

describe('game card fonts', () => {
  it('blessing card: heading title, game-text effects, Bebas cost, no greyscale star', () => {
    const html = renderToStaticMarkup(<ReadOnlyBlessingGrid blessings={[blessing]} selectedBlessings={new Map([[100, 1]])} emptyText="" />)
    expect(html).toMatch(/font-family:var\(--font-heading\)[^>]*>시작의 별</)
    expect(html).toMatch(/font-family:var\(--font-game-text\)[^"]*"[^>]*>(?:(?!<\/div>)[\s\S])*코스트/)
    expect(html).toMatch(/font-family:var\(--font-title\)[^>]*>10</)
    expect(html).not.toContain('grayscale')
    expect(html).not.toContain('&lt;k&gt;')
  })

  it('constraint card: heading title, game-text description, Bebas reward and score', () => {
    const html = renderToStaticMarkup(<FloorConstraints floor={11} entries={[{ floor: 11, constraints: [] }]} onChange={() => {}} />)
    expect(html).toMatch(/<strong[^>]*var\(--font-heading\)[^>]*>레벨 강화</)
    expect(html).toMatch(/<span[^>]*var\(--font-game-text\)[^>]*>모든 적 레벨 3 증가/)
    expect(html).toMatch(/<strong[^>]*var\(--font-title\)[^>]*>15</)
    expect(html).toMatch(/<strong[^>]*var\(--font-title\)[^>]*>0</)
  })
})

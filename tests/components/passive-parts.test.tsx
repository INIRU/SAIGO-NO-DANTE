import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MultipliedCount, PassiveNameLabel, PassiveRequirements } from '@/components/passive/PassiveParts'

describe('REQ-CATALOG-017 passive label and drawn multiplication sign', () => {
  it('REQ-CATALOG-017 draws × as an SVG in front of the count, never the letter x', () => {
    const html = renderToStaticMarkup(<MultipliedCount value={2} />)
    expect(html).toContain('<svg')
    expect(html).toContain('>2<')
    expect(html).not.toMatch(/[x×]2/)
  })

  it('REQ-CATALOG-017 shows every sin of a passive with its own count and the condition word', () => {
    const html = renderToStaticMarkup(
      <PassiveRequirements requirements={[{ sin: 'envy', count: 2 }, { sin: 'sloth', count: 3 }]} condition="보유" sinLabel={sin => sin} />,
    )
    expect(html.match(/<svg/g)).toHaveLength(2)
    expect(html).toContain('alt="envy"')
    expect(html).toContain('alt="sloth"')
    expect(html).toContain('>2<')
    expect(html).toContain('>3<')
    expect(html).toContain('보유')
  })

  it('REQ-CATALOG-017 names a passive on the skill banner in one passive colour, the same for every passive', () => {
    const a = renderToStaticMarkup(<PassiveNameLabel>검은 언약</PassiveNameLabel>)
    const b = renderToStaticMarkup(<PassiveNameLabel>진형 보존</PassiveNameLabel>)
    expect(a).toContain('data-skill-name-banner')
    expect(a).toContain('검은 언약')
    const colours = (html: string) => html.match(/#[0-9a-f]{6}[0-9a-f]{2}/gi)
    expect(colours(a)).toEqual(colours(b))
  })
})

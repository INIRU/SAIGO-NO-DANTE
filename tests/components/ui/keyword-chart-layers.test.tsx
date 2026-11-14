import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import KeywordChart from '@/components/ui/KeywordChart'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: { count?: number }) => `${key}:${values?.count ?? ''}` }))

describe('keyword chart layers', () => {
  it('draws a dark all-placed bar behind the deployed bar, with a legend of the real counts', () => {
    // six deployed of nine placed: the legend says 6 and 9, not the formation cap (7) or the sinner count (12)
    const html = renderToStaticMarkup(<KeywordChart distribution={[{ keyword: '화상', count: 4, deployed: 3 }]} deployedCount={6} totalCount={9} />)
    expect(html).toContain('keywordDeployed:6')
    expect(html).toContain('keywordAll:9')
    expect(html).not.toContain('keywordDeployed:7')
    expect(html).toContain('opacity:0.32')
    expect(html).toMatch(/3<span[^>]*>\/4<\/span>/)
  })

  it('draws rows that are not keywords: their own icon and colour, and something at the end of the row', () => {
    const html = renderToStaticMarkup(<KeywordChart distribution={[{ keyword: 'wrath', count: 6, iconUrl: '/sin-wrath.webp', color: '#ff0000', extra: <b>cost</b> }]} />)
    expect(html).toContain('sin-wrath.webp')
    expect(html).toContain('background:#ff0000')
    expect(html).toContain('>6<')
    expect(html).toContain('<b>cost</b>')
  })

  it('keeps one bar and one count without deployment flags', () => {
    const html = renderToStaticMarkup(<KeywordChart distribution={[{ keyword: '화상', count: 4 }]} />)
    expect(html).not.toContain('keywordDeployed')
    expect(html).not.toContain('opacity:0.32')
    expect(html).toContain('>4<')
  })
})

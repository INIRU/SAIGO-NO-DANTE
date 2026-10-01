import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import KeywordChart from '@/components/planner/KeywordChart'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: { count?: number }) => `${key}:${values?.count ?? ''}` }))

describe('REQ-DECKS-013 keyword chart layers', () => {
  it('REQ-DECKS-013 draws a dark all-12 bar behind the deployed bar, with a legend and deployed/all counts', () => {
    const html = renderToStaticMarkup(<KeywordChart distribution={[{ keyword: '화상', count: 4, deployed: 3 }]} />)
    expect(html).toContain('keywordDeployed:7')
    expect(html).toContain('keywordAll:12')
    expect(html).toContain('opacity:0.32')
    expect(html).toMatch(/3<span[^>]*>\/4<\/span>/)
  })

  it('REQ-DECKS-013 keeps one bar and one count without deployment flags', () => {
    const html = renderToStaticMarkup(<KeywordChart distribution={[{ keyword: '화상', count: 4 }]} />)
    expect(html).not.toContain('keywordDeployed')
    expect(html).not.toContain('opacity:0.32')
    expect(html).toContain('>4<')
  })
})

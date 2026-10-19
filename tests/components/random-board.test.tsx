import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { generateRandom } from '@/lib/random/engine'
import { rngFromSeed } from '@/lib/random/seed'
import { BASE_OPTIONS, EGOS, IDENTITIES, SINNERS } from '../lib/random/fixture'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values?.name ? `${key}:${values.name}` : key),
  useLocale: () => 'ko',
}))

const result = generateRandom(SINNERS, IDENTITIES, EGOS, { ...BASE_OPTIONS, deploy: { min: 3, max: 3 } }, rngFromSeed('board'))
const pools = Object.fromEntries(SINNERS.map(sinner => [sinner.id, IDENTITIES.filter(identity => identity.sinner_id === sinner.id)]))
const all = new Set(SINNERS.map(sinner => sinner.id))
const stamps = Object.fromEntries(SINNERS.map(sinner => [sinner.id, 1]))

async function render(props: Record<string, unknown> = {}) {
  const { default: ResultGrid } = await import('@/components/random/ResultGrid')
  return renderToStaticMarkup(
    <ResultGrid sinners={SINNERS} pools={pools} result={result} view="identity" revealing={false} fresh={all} stamps={stamps} marks={[]}
      onReroll={() => {}} onToggleMark={() => {}} {...props} />,
  )
}

describe('REQ-TOOLS-015 lock buttons on the board', () => {
  it('REQ-TOOLS-015 puts an icon lock button on every identity card, pressed for the marked sinners', async () => {
    const html = await render({ marks: ['s2', 's5'] })
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(10)
    expect(html).toContain('unlock:인격 2-')
    expect(html).toContain('lock:인격 1-')
    // Icon only: the button holds an svg and no text.
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*><svg[\s\S]*?<\/svg><\/button>/)
  })

  it('REQ-TOOLS-015 does not let a locked card be rerolled and keeps its lock reachable', async () => {
    const html = await render({ marks: ['s1'] })
    const first = html.split('<li class=')[1]
    expect(first).toContain('disabled')
    expect(first).toContain('aria-pressed="true"')
  })

  it('REQ-TOOLS-015 gives the E.G.O cells their lock button too', async () => {
    const html = await render({ view: 'ego', marks: ['s3'] })
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed=/g)).toHaveLength(12)
  })
})

describe('REQ-TOOLS-016 numbers on the board', () => {
  it('REQ-TOOLS-016 shows the rolled number on exactly the numbered cards, with the SELECTED banner', async () => {
    const html = await render()
    expect(html.match(/class="_number_\w+"/g)).toHaveLength(3)
    expect(result.order).toHaveLength(3)
  })

  it('REQ-TOOLS-005 shows no numbers when no order was rolled', async () => {
    const { default: ResultGrid } = await import('@/components/random/ResultGrid')
    const plain = { ...result, order: null }
    const html = renderToStaticMarkup(
      <ResultGrid sinners={SINNERS} pools={pools} result={plain} view="identity" revealing={false} fresh={all} stamps={stamps} marks={[]}
        onReroll={() => {}} onToggleMark={() => {}} />,
    )
    expect(html).not.toMatch(/class="_number_\w+"/)
  })
})

describe('REQ-TOOLS-019 reveal markup', () => {
  it('REQ-TOOLS-019 reveals only while revealing, and only the cards the action drew, in rank order', async () => {
    const quiet = await render()
    expect(quiet).not.toContain('data-reveal')
    const fresh = new Set(['s3', 's4'])
    const html = await render({ revealing: true, fresh })
    expect(html).toContain('data-reveal="true"')
    expect(html.match(/data-fresh="true"/g)).toHaveLength(2)
    expect(html.match(/--rank:/g)).toHaveLength(12)
  })

  it('REQ-TOOLS-019 marks the 3-star identity cards as golden', async () => {
    const html = await render()
    const threeStars = Object.values(result.identities).filter(identity => identity?.rarity === 3).length
    expect(html.match(/data-rare="true"/g) ?? []).toHaveLength(threeStars)
  })

  it('REQ-TOOLS-019 numbers the summary under the board with the counts of the result', async () => {
    const { default: ResultSummary } = await import('@/components/random/ResultSummary')
    const html = renderToStaticMarkup(<ResultSummary result={result} identityEnabled egoEnabled />)
    const threeStars = Object.values(result.identities).filter(identity => identity?.rarity === 3).length
    expect(html).toContain(`<b class="`)
    expect(html.match(/<b [^>]*>(\d+)<\/b>/g)).toHaveLength(8)
    expect(html).toContain(`>${threeStars}</b>`)
    const empty = renderToStaticMarkup(<ResultSummary result={null} identityEnabled egoEnabled={false} />)
    expect(empty.match(/<b [^>]*>0<\/b>/g)).toHaveLength(3)
    expect(empty).not.toContain('ZAYIN')
  })
})

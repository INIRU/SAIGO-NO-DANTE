import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GiftConditionDivider } from '@/components/ui/GiftCondition'
import type { GiftConditionStatus } from '@/lib/planner/gift-condition-status'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

const status: GiftConditionStatus = { level: 'warn', kind: 'keyword', subjects: ['Breath'], need: 5, formation: 3, all: 3 }
const render = (props: Partial<Parameters<typeof GiftConditionDivider>[0]> = {}) =>
  renderToStaticMarkup(<GiftConditionDivider text="호흡 인격 5인 이상" {...props} />)
const head = (html: string) => html.match(/<header[^>]*>(.*?)<\/header>/)![1]

describe('REQ-MIRROR-DUNGEON-027 gift condition line keeps two tidy rows', () => {
  it('REQ-MIRROR-DUNGEON-027 the header holds the rules and the title only; chip and status sit in a meta row', () => {
    const html = render({ scope: 'deployed', status })
    expect(head(html)).toContain('gateTitle')
    expect(head(html)).not.toContain('gateChip')
    expect(head(html)).not.toContain('gateStatus')
    expect(head(html).match(/<i /g)).toHaveLength(2)
    const meta = html.match(/<div class="[^"]*gateMeta[^"]*">(.*)<\/div>/)![1]
    expect(meta).toContain('gateChip')
    expect(meta).toContain('gateStatus')
    expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('gateMeta'))
  })

  it('REQ-MIRROR-DUNGEON-027 no meta row when there is no chip or status', () => {
    expect(render()).not.toContain('gateMeta')
  })
})

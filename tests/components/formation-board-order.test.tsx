import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string, values?: Record<string, unknown>) => key + (values ? JSON.stringify(values) : '') }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/IdentityFrameCard', () => ({ default: ({ name }: { name: string }) => <span>{name}</span>, getFormationOverlay: (order: number | null) => (order === null ? undefined : { kind: 'selected', order: order + 1 }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>, useRouter: () => ({}), usePathname: () => '/' }))
vi.mock('@/lib/toast', () => ({ showSuccess: () => {}, showError: () => {} }))

import { PlannerIdentityBoard } from '@/components/planner/deck/PlannerDeckSelection'

const sinners = [{ id: 'a', name_kr: '가' }, { id: 'b', name_kr: '나' }]
const identity = (id: string, sinner: string) => ({ id, sinner_id: sinner, name_kr: id, rarity: 3, game_id: '1', folder_name: 'x' })
const slots = { a: { sinnerId: 'a', identity: identity('ia', 'a'), slotOrder: 0 }, b: { sinnerId: 'b', identity: identity('ib', 'b'), slotOrder: null } }
const render = (extra: object) => renderToStaticMarkup(
  <PlannerIdentityBoard sinners={sinners} slots={slots} onOpenIdentityModal={() => {}} onFormationToggle={() => {}} {...extra} />,
)

describe('formation board order badge', () => {
  it('REQ-DECKS-027 puts a change button on the number of an ordered card, at least 44px tall, when it can change the order', () => {
    const html = render({ onOrderChange: () => {}, orderCount: 1 })
    expect(html.match(/data-order-button/g)).toHaveLength(1)
    expect(html).toContain('changeOrder')
    expect(html).toContain('min-height:2.75rem')
  })

  it('REQ-DECKS-027 leaves the board as it was without the order handler (the planner editor)', () => {
    expect(render({})).not.toContain('data-order-button')
  })
})

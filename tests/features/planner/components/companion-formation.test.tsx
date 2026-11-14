import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import CompanionFormation from '@/features/planner/components/CompanionFormation'
import { formationRow } from '@/features/planner/lib/assist-gift-guide'
import type { IdentitySlot } from '@/lib/planner/types'

vi.mock('@/components/ui/QuietImage', () => ({ default: ({ src }: { src: string }) => <span data-test-image={src} /> }))
vi.mock('@/components/cards/IdentityFrameCard', () => ({ default: ({ order }: { order: number }) => <span data-test-card={order} /> }))

const sinners = [{ id: 'faust', order_num: 2 }, { id: 'yi-sang', order_num: 1 }, { id: 'don-quixote', order_num: 3 }]
const slot = (sinner_id: string, slot_order: number) => ({ identity_id: `${sinner_id}-x`, sinner_id, name_kr: `${sinner_id} 인격`, rarity: 3, keywords: [],
  game_id: '10101', folder_name: 'Folder', slot_order }) as IdentitySlot

it('shows the run formation in sinner order with formation numbers, dims the bench and offers the code', () => {
  const html = renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages}>
    <CompanionFormation cells={formationRow([slot('faust', 0), slot('yi-sang', 7)], sinners)} code="ABC" width={356} height={300} />
  </NextIntlClientProvider>)
  const cells = [...html.matchAll(/data-formation-sinner="([^"]+)"/g)].map(match => match[1])
  expect(cells).toEqual(['yi-sang', 'faust', 'don-quixote'])
  expect([...html.matchAll(/data-formation-position="(\d+)"/g)].map(match => match[1])).toEqual(['8', '1'])
  expect(html).toMatch(/data-formation-sinner="yi-sang"[^>]*data-bench="true"/)
  expect(html).toMatch(/data-formation-sinner="don-quixote"[^>]*data-empty="true"/)
  expect(html).toContain('aria-label="faust 인격 · 1"')
  expect(html).toContain(messages.planner.detail.copyDeckCode)
  // Game formation cards, 6 to a row, whatever the window.
  expect(html).toContain('data-test-card="0"')
  expect(html).toMatch(/grid-template-columns:repeat\(6, \d+px\)/)
})

it('hides the copy button when the run has no formation code', () => {
  const html = renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages}>
    <CompanionFormation cells={formationRow([], sinners)} code="" width={356} height={300} />
  </NextIntlClientProvider>)
  expect(html).not.toContain(messages.planner.detail.copyDeckCode)
})

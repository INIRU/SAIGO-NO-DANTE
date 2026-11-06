import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import CompanionClearBonus from '@/components/planner/run/CompanionClearBonus'
import type { GiftData } from '@/lib/planner/types'

vi.mock('@/components/ui/GiftArtwork', () => ({ default: () => <span data-test-artwork /> }))
// the site's preview card (hover) needs the router; the cells are what these tests read
vi.mock('@/features/notes/components/NotePreviewCard', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

const gift = (id: number, name: string) => ({ game_id: id, name, name_en: null, name_jp: null }) as unknown as GiftData
const gifts = [gift(9726, '가'), gift(9724, '나'), gift(9723, '다'), gift(9722, '라')]
const render = (planned: number[], owned: number[], picks: number) => renderToStaticMarkup(
  <NextIntlClientProvider locale="ko" messages={messages}>
    <CompanionClearBonus gifts={gifts} planned={new Set(planned)} owned={new Set(owned)} picks={picks} />
  </NextIntlClientProvider>)

it('tells a planned bonus gift need not be bought, while the picks cover the planned ones', () => {
  const html = render([9724], [], 1)
  expect(html).toContain('이 층 보스를 이기면 이 중 1개를 골라 가져요')
  expect(html).toContain('나: 클리어 보너스로 받을 수 있으니 상점에서 사지 않아도 돼요')
  expect(html.match(/data-bonus-planned/g)).toHaveLength(1)
})

it('says to buy the rest when more planned gifts are in it than can be taken, and leaves owned ones out', () => {
  expect(render([9724, 9722, 9723], [9723], 1)).toContain('계획 기프트가 2개 있지만 보너스로는 1개만 골라요')
  expect(render([9724, 9722], [], 2)).toContain('나, 라: 클리어 보너스로 받을 수 있으니')
})

it('says so when no planned gift is in it', () => {
  expect(render([], [], 2)).toContain('계획한 기프트는 없어요')
})

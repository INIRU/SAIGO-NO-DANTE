import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/ko.json'
import FloorPlanPreviewBoard from '@/components/planner/FloorPlanPreviewBoard'
import type { GiftData, ThemeData } from '@/lib/planner/types'

vi.mock('@/components/ui/GiftArtwork', () => ({ default: ({ children }: { children?: unknown }) => <span data-test-artwork>{children as never}</span> }))
vi.mock('@/components/ui/ImageWithFallback', () => ({ default: () => <span data-test-poster /> }))
vi.mock('@/components/planner/FloorGuidance', () => ({ default: () => null }))
vi.mock('@/components/planner/FloorConstraints', () => ({ default: () => null }))

const pack = (id: string, rewards: number[] | null): ThemeData => ({ id, name: `pack-${id}`, dungeon_id: null, ego_gift_ids: [10], specific_ego_gift_ids: [],
  fixed_reward_gift_ids: rewards, image_url: null, difficulty: 'extreme', floor_info: null })
const gift = (game_id: number) => ({ id: String(game_id), game_id, name: `gift-${game_id}`, keyword: null, grade: '4', image_url: null,
  effect_base: null, effect_plus: null, effect_plusplus: null, theme_ids: null, activation_condition: null }) as GiftData

it('shows an extreme pack clear reward on its floor even when the plan did not list it', () => {
  const html = renderToStaticMarkup(<NextIntlClientProvider locale="ko" messages={messages} timeZone="Asia/Seoul">
    <FloorPlanPreviewBoard planDifficulty="extreme" giftMap={new Map([10, 9250].map(id => [id, gift(id)]))}
      themeMap={new Map([['1511', pack('1511', [9250])], ['1', pack('1', null)]])}
      floorPlan={[{ floor: 11, theme_id: '1511', gift_ids: ['10'], memo: '' }, { floor: 12, theme_id: '1', gift_ids: ['10'], memo: '' }]} />
  </NextIntlClientProvider>)
  const rows = html.split('floor-preview-row').slice(1)
  expect(rows[0]).toContain('gift-10')
  expect(rows[0]).toMatch(/aria-label="gift-9250 · [^"]+"/)
  expect(rows[1]).not.toContain('gift-9250')
})

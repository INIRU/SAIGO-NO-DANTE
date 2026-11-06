import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import HeroGlitchSlider from '@/app/[lang]/(home)/_components/HeroGlitchSlider'
import type { IdentityWithSinner } from '@/lib/data/sinners'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

const identity = {
  id: 'a', sinner_id: 'yi-sang', game_id: '10101', folder_name: 'LCB Sinner', name_kr: '이상', name_en: 'Yi Sang', name_jp: 'イサン',
  release_date: '2026-09-01',
} as unknown as IdentityWithSinner

// The home hero is server-rendered so its first artwork is in the HTML (it was client-only before).
it('renders the first slide on the server without touching browser APIs', () => {
  const html = renderToString(<HeroGlitchSlider identities={[identity]} onSlideChange={() => {}} />)
  expect(html).toContain('data-hero-slider')
  expect(html).toMatch(/<img[^>]+10101_normal\.webp/)
  // Shown at 50% opacity under gradients: requested at quality 75.
  expect(html).toContain('q=75')
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GiftEnhancePicker } from '@/features/mirror-dungeon/components/GiftCard'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

const render = (level: number, bare?: boolean) =>
  renderToStaticMarkup(<GiftEnhancePicker level={level} max={2} giftName="블러디 가젯" onChange={() => {}} bare={bare} />)
/** The sprite each radio shows, in order (base, +, ++). */
const sprites = (html: string) =>
  [...html.matchAll(/role="radio".*?enhance-(minus|plus-idle|plusplus-idle|plusplus|plus)[.]webp/g)].map(m => m[1])

describe('gift enhance switch draws the game sprites', () => {
  it('the picked level shows its lit sprite, the others their idle sprite', () => {
    expect(sprites(render(0))).toEqual(['minus', 'plus-idle', 'plusplus-idle'])
    expect(sprites(render(1))).toEqual(['minus', 'plus', 'plusplus-idle'])
    expect(sprites(render(2))).toEqual(['minus', 'plus-idle', 'plusplus'])
  })

  it('the bare switch of the detail window has no box and 44px targets', () => {
    const html = render(2, true)
    expect(sprites(html)).toEqual(['minus', 'plus-idle', 'plusplus'])
    expect(html).not.toContain('border')
    expect(html.match(/min-h-11 min-w-11/g)).toHaveLength(3)
  })
})

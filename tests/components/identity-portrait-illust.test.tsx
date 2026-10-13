import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Identity, Sinner } from '@/lib/data/sinners'
import type { IdentitySpine } from '@/lib/spine/pack'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))

import IdentityPortraitSection from '@/components/identity/IdentityPortraitSection'

const sinner = { id: 'rodion', name: 'Rodion', name_kr: '로쟈', name_jp: 'ロージャ' } as Sinner
const identity = { id: 'identity-1', sinner_id: 'rodion', name: '인격', name_kr: '인격', rarity: 3 } as unknown as Identity
// with a game id and a folder the identity has illustrations to show
const pictured = { ...identity, game_id: '10916', folder_name: 'Thumb Capo' } as unknown as Identity
const frame = { x: 0, y: 0, w: 1536, h: 864 }
const illust: IdentitySpine = { base: 'spine/illust/', skeletons: {}, forms: [{ prefab: '1_gacksung', frame, safe: frame, layers: [] }] }

function portrait(gacksung: boolean, art: IdentitySpine | null, who = identity) {
  return renderToStaticMarkup(
    <IdentityPortraitSection sinner={sinner} identity={who} gacksung={gacksung} setGacksung={() => {}}
      showFullArt={false} setShowFullArt={() => {}} sinColor="#c8900a" rarityNum={3} illust={art} />,
  )
}

describe('identity portrait animated illustration', () => {
  it('REQ-CATALOG-027 marks the uptie illustration tab as animated when the identity has a full illustration skeleton', () => {
    for (const gacksung of [false, true]) {
      expect(portrait(gacksung, illust)).toMatch(/aria-label="identity\.portrait\.animated"[^]*identity\.portrait\.uptieIllustration<\/button>/)
    }
  })

  it('REQ-CATALOG-027 leaves the tab of an identity without a skeleton unmarked', () => {
    expect(portrait(true, null)).not.toContain('identity.portrait.animated')
  })
})

describe('identity portrait full illustration button', () => {
  it('REQ-CATALOG-028 always offers the full illustration under the card', () => {
    const html = portrait(false, null, pictured)
    expect(html).toMatch(/<button[^>]*>(?:<svg[^]*?<\/svg>)?identity\.portrait\.viewFull<\/button>/)
    expect(html).not.toContain('artTip')
  })

  it('REQ-CATALOG-028 offers nothing for an identity without an illustration', () => {
    expect(portrait(false, null)).not.toContain('identity.portrait.viewFull')
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, type KeywordInfo } from '@/components/providers/KeywordProvider'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import KeywordCard, { type KeywordEntry } from '@/app/[lang]/keywords/_components/KeywordCard'
import { EffectText } from '@/features/mirror-dungeon/components/GiftDetailModal'
import type { GameTextRefNames } from '@/lib/game-text/ref-names'

const REFS: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
}
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('@/hooks/useGameTextRefs', () => ({
  useGameTextRefs: () => ({ names: REFS, refIds: new Set(Object.keys(REFS)) }),
  wantGameTextRefs: () => {},
  preloadGameTextRefDescriptions: () => {},
  useGameTextRefDescription: () => undefined,
}))

const RAW_DESC = '<style="highlight">[Combustion] 3</style> 부여\n<color=#ff0000>끝</color>'
const KEYWORDS: Record<string, KeywordInfo> = { 화상: { desc: RAW_DESC, iconSlug: 'burn', effectType: 'negative' } }
const wrap = (node: React.ReactNode) => renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}>{node}</KeywordProvider>)

describe('flavor text of raw game text', () => {
  it('draws the tags of a skill flavor as styling, not as text', () => {
    const html = wrap(<SkillDescription description="" flavorText={'<i>속삭임</i> <color=#ff0000>붉은</color> 끝'} accentColor="#c2b79f" />)
    expect(html).not.toContain('&lt;')
    expect(html).toContain('붉은')
    // The colour tag is read, its colour is not applied.
    expect(html).not.toContain('color:#ff0000')
    expect(html).toContain('font-style:italic')
  })

  it('leaves a flavor of the older format as written and never turns its words into keywords', () => {
    const html = wrap(<SkillDescription description="" flavorText={'화상 입은 [적중시] 이야기'} accentColor="#c2b79f" />)
    expect(html).toContain('화상 입은 [적중시] 이야기')
    expect(html).not.toContain('keyword-token')
  })
})

describe('keyword descriptions with tags', () => {
  const entry: KeywordEntry = {
    name: '화상', description: RAW_DESC, max_stack: null, icon_slug: 'burn', sin_affinity: null, category: null,
  }

  it('shows the keyword card preview as plain text: tags gone, [Id] as its name', () => {
    const html = wrap(<KeywordCard keyword={entry} counts={{ identity: 0, ego: 0, gift: 0 }} onClick={() => {}} lang="ko" />)
    expect(html).not.toContain('&lt;')
    expect(html).not.toContain('[Combustion]')
    expect(html).toContain('화상 3 부여')
  })

})

describe('a tag that spans lines keeps applying on every line', () => {
  const SPAN = '<style="highlight">- 첫째\n- 둘째</style>'
  // The highlight colour is no longer drawn: each line must still lose the tag and keep its text.
  const both = (html: string) => html.includes('첫째') && html.includes('둘째') && !html.includes('#f8c200') && !html.includes('style=&quot;')

  it('in the gift detail effect, keeping the bullet layout of a highlighted line', () => {
    const html = wrap(<EffectText text={SPAN} color="#c2b79f" />)
    expect(html).not.toContain('&lt;')
    expect(both(html)).toBe(true)
    expect(html.match(/text-indent:-0\.625rem/g)?.length).toBe(2)
  })
})

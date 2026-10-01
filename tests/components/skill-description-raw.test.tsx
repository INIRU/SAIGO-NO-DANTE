import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, type KeywordInfo } from '@/components/providers/KeywordProvider'
import SkillDescription from '@/components/skill/SkillDescription'
import { UptieChangePanel } from '@/components/identity/UptieChanges'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const REFS: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
  SuperCoin: { k: 'keyword', n: '파괴 불가 코인' },
}
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
// A server render never loads the lazy table (the hook waits for a browser), so the loaded table is stood in directly.
vi.mock('@/lib/hooks/useGameTextRefs', () => ({
  useGameTextRefs: () => ({ names: REFS, refIds: new Set(Object.keys(REFS)) }),
  wantGameTextRefs: () => {},
  preloadGameTextRefDescriptions: () => {},
  useGameTextRefDescription: () => undefined,
}))

const KEYWORDS: Record<string, KeywordInfo> = { 화상: { desc: '', iconSlug: 'burn', effectType: 'negative' } }
const wrap = (node: React.ReactNode) => renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}>{node}</KeywordProvider>)

const RAW = '[OnSucceedAttack] 본문\n<coin=1>[SuperCoin]\n<style="highlight">- [Combustion] 1\n- 둘째</style></coin>\n<coin=2>[OnSucceedAttack] 일반</coin>'

describe('REQ-SHARED-020 SkillDescription of raw text', () => {
  it('REQ-SHARED-020 REQ-SHARED-025 draws the coin blocks as coin sections (octagon and numeral), the unbreakable marker as the SuperCoin keyword, and no raw tags', () => {
    for (const variant of ['detail', 'compact', 'tooltip'] as const) {
      const html = wrap(<SkillDescription description={RAW} accentColor="#c2b79f" variant={variant} />)
      // The unbreakable marker is the game's [SuperCoin] keyword (name from the reference table, with its tooltip).
      expect(html).toContain('파괴 불가 코인')
      expect(html).not.toContain('identity.skills.unbreakableCoin')
      // With coin badges each coin is the game's octagon with its Roman numeral sprite.
      if (variant !== 'tooltip') {
        expect(html).toContain('coins%2Fframe')
        expect(html).toContain('coins%2Fnumerals%2F1')
        expect(html).toContain('coins%2Fnumerals%2F2')
      }
      expect(html).toContain('화상')
      expect(html).toContain('일반')
      expect(html).not.toContain('&lt;')
      expect(html).not.toContain('[SuperCoin]')
      expect(html).not.toContain('&lt;')
    }
  })

  it('REQ-SHARED-020 draws every line of a tag that spans lines without the tag or a highlight colour (REQ-SHARED-022)', () => {
    const html = wrap(<SkillDescription description={RAW} accentColor="#c2b79f" variant="detail" />)
    expect(html).not.toContain('#f8c200')
    expect(html).not.toContain('style=&quot;')
    expect(html).toContain('둘째')
  })

  it('REQ-SHARED-020 draws the older [코인 N] text as before', () => {
    const html = wrap(<SkillDescription description={'본문\n[코인 1] 파괴 불가 코인\n화상 2 부여'} accentColor="#c2b79f" variant="compact" />)
    expect(html).toContain('파괴 불가 코인')
    expect(html).toContain('화상')
  })
})

describe('REQ-SHARED-020 uptie change panel with raw text', () => {
  it('REQ-SHARED-020 shows a removed raw line as plain struck text and an added one as game text', () => {
    const html = wrap(
      <UptieChangePanel
        level={4}
        accentColor="#c2b79f"
        lines={[
          { kind: 'removed', coin: 1, text: '<style="highlight">[Combustion] 2 {{potency}}</style>' },
          { kind: 'added', coin: 1, text: '<style="highlight">[Combustion] 3</style>' },
        ]}
      />,
    )
    expect(html).not.toContain('&lt;')
    expect(html).not.toContain('[Combustion]')
    expect(html).toMatch(/<s [^>]*>화상 2 \([^)]+\)<\/s>/)
  })

  it('REQ-SHARED-020 leaves a removed line of the older format exactly as written', () => {
    const html = wrap(<UptieChangePanel level={4} accentColor="#c2b79f" lines={[{ kind: 'removed', coin: 0, text: '[적중시] 화상 2 {{potency}}' }]} />)
    expect(html).toContain('[적중시] 화상 2 {{potency}}')
  })
})

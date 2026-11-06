import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, type KeywordInfo } from '@/components/providers/KeywordProvider'
import IdentitySkillFrameCard from '@/features/catalog/components/IdentitySkillFrameCard'
import { SIN_COLORS } from '@/lib/constants/sin'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const REFS: GameTextRefNames = {
  Sinking: { k: 'keyword', n: '침잠', kw: '침잠' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
  DefeatDuel: { k: 'skilltag', n: '[합 패배시]' },
  WhenUse: { k: 'skilltag', n: '[사용시]' },
}
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('swr', () => ({
  default: (key: string | null) => ({ data: key?.startsWith('/api/game-text-refs/') ? REFS : undefined }),
  preload: () => Promise.resolve(),
}))

const KEYWORDS: Record<string, KeywordInfo> = {
  진동: { desc: '', iconSlug: 'tremor', effectType: 'negative', nameEn: 'Tremor', nameJp: '振動' },
  침잠: { desc: '', iconSlug: 'sinking', effectType: 'negative', nameEn: 'Sinking', nameJp: '沈潜' },
  침잠쇄도: { desc: '', iconSlug: 'sinking-deluge', effectType: 'negative', nameEn: 'Sinking Deluge', nameJp: '沈潜殺到' },
}
// 개화 E.G.O:: 동백 (game_id 10104), skill 3, as the game wrote it: 진동, 침잠 and 침잠쇄도 are plain words.
const DONGBAEK = '[DefeatDuel] 정신력 20 감소\n[WhenUse] 진동 횟수 6을 얻음\n<coin=1>[OnSucceedAttack] 침잠 횟수 1 증가</coin>\n<coin=2>[OnSucceedAttack] 침잠 횟수 1 증가</coin>\n<coin=3>[OnSucceedAttack] 대상의 [Sinking]이 6 이상이면, 침잠쇄도\n[OnSucceedAttack] 자신의 진동 횟수가 10 이상이면, 피해량의 40%만큼 추가 피해</coin>'
const skill = (id: string, name: string, description: string, skill_order: number) => ({
  id, name, skill_type: 'attack', atk_type: 'slash', sin_affinity: 'gloom', coins: 3, base_power: 4, coin_power: 3, description, skill_order,
})
const identity = { sinner_id: 'yi-sang', game_id: '10104', keywords: ['진동', '침잠', '침잠쇄도'] }
const card = (description: string) => {
  const own = skill('s3', '동백의 숨', description, 3)
  const other = skill('s1', '침잠의 파도', '', 1)
  return renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><IdentitySkillFrameCard skill={own} skills={[other, own]} identity={identity} lang="ko" /></KeywordProvider>)
}
const tokens = (html: string) => html.match(/keyword-token/g)?.length ?? 0

describe('REQ-KEYWORDS-008 a skill card outside the identity page reads its text like the identity page', () => {
  it('REQ-KEYWORDS-008 draws the plain keywords of older text from the identity\'s own keywords, with no set handed over', () => {
    // 진동 ×2, 침잠 ×2, the [Sinking] ref and 침잠쇄도: as on the identity page.
    expect(tokens(card(DONGBAEK))).toBe(6)
  })

  it('REQ-KEYWORDS-008 colours the identity\'s own skill names by their sin', () => {
    const html = card('침잠의 파도 후 침잠 3 부여')
    expect(html).toContain(`color:${SIN_COLORS.gloom}`)
    expect(tokens(html)).toBe(1)
  })
})

describe('REQ-CATALOG-037 a skill card outside the identity page draws the game skill box', () => {
  it('uses the game frame and name plate instead of the old frame and banner', () => {
    const html = card(DONGBAEK)
    expect(html).toContain('ui/skill-frame/gloom-3.webp')
    expect(html).toContain('ui/skill-frame/gloom-name.webp')
    expect(html).not.toContain('/assets/skill-frames/')
  })
})

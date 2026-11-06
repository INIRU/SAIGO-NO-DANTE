import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, resolveKeywordIconUrl, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import SkillDescription from '@/components/skill/SkillDescription'
import { keywordTextAllowed } from '@/lib/keywords/plain-keywords'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const REFS: GameTextRefNames = {
  Sinking: { k: 'keyword', n: '침잠', kw: '침잠' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
  DefeatDuel: { k: 'skilltag', n: '[합 패배시]' },
  WhenUse: { k: 'skilltag', n: '[사용시]' },
}

let currentLocale = 'ko'
vi.mock('next-intl', () => ({
  useLocale: () => currentLocale,
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({
  default: (key: string | null) => ({ data: key?.startsWith('/api/game-text-refs/') ? REFS : undefined }),
  preload: () => Promise.resolve(),
}))

const KEYWORDS: Record<string, KeywordInfo> = {
  진동: { desc: '', iconSlug: 'tremor', effectType: 'negative', nameEn: 'Tremor', nameJp: '振動' },
  '진동 폭발': { desc: '', iconSlug: 'tremor-burst', effectType: 'negative', nameEn: 'Tremor Burst', nameJp: '振動爆発' },
  침잠: { desc: '', iconSlug: 'sinking', effectType: 'negative', nameEn: 'Sinking', nameJp: '沈潜' },
  침잠쇄도: { desc: '', iconSlug: 'sinking-deluge', effectType: 'negative', nameEn: 'Sinking Deluge', nameJp: '沈潜殺到' },
  신속: { desc: '', iconSlug: 'haste', effectType: 'positive', nameEn: 'Haste', nameJp: 'クイック' },
  보호: { desc: '', iconSlug: 'protection', effectType: 'positive', nameEn: 'Protection', nameJp: '保護' },
  버림: { desc: '', iconSlug: 'discard', nameEn: 'Discard', nameJp: '捨てる' },
}
const OWN = new Set(['진동', '침잠', '침잠쇄도'])

type Options = Parameters<ReturnType<typeof useFormatSkillDesc>>[4]
function Formatter({ text, skillNameColors, allowed, options }: { text: string; skillNameColors?: Record<string, string>; allowed: ReadonlySet<string> | null; options?: Options }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#abcdef', skillNameColors, allowed ?? undefined, options)}</>
}
/** `allowed` null: the caller gave no set. `options` defaults to switched on; `{}` is what every other caller passes. */
const render = (text: string, allowed: ReadonlySet<string> | null = OWN, options: Options = { matchPlainKeywords: true }, skillNameColors?: Record<string, string>) =>
  renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Formatter text={text} allowed={allowed} options={options} skillNameColors={skillNameColors} /></KeywordProvider>)
const tokens = (html: string) => html.match(/keyword-token/g)?.length ?? 0

// 개화 E.G.O:: 동백 (game_id 10104), skill 3, as the game wrote it.
const DONGBAEK = '[DefeatDuel] 정신력 20 감소\n[WhenUse] 진동 횟수 6을 얻음\n<coin=1>[OnSucceedAttack] 침잠 횟수 1 증가</coin>\n<coin=2>[OnSucceedAttack] 침잠 횟수 1 증가</coin>\n<coin=3>[OnSucceedAttack] 대상의 [Sinking]이 6 이상이면, 침잠쇄도\n[OnSucceedAttack] 자신의 진동 횟수가 10 이상이면, 피해량의 40%만큼 추가 피해</coin>'

describe('REQ-KEYWORDS-007 plain keywords of older skill text', () => {
  it('REQ-KEYWORDS-007 REQ-SHARED-021 draws 진동 and 침잠쇄도 of the 동백 skill as keywords when the owner turns it on, and leaves them plain otherwise', () => {
    const on = render(DONGBAEK)
    // 진동 ×2, 침잠 ×2, the [Sinking] ref and 침잠쇄도.
    expect(tokens(on)).toBe(6)
    expect(on).toContain('>침잠쇄도<')
    expect(on).toContain(resolveKeywordIconUrl('침잠쇄도', 'sinking-deluge')!.split('/').pop()!)
    expect(on).toContain(resolveKeywordIconUrl('진동', 'tremor')!.split('/').pop()!)
    expect(on).toContain('data-game-ref="Sinking"')

    const off = render(DONGBAEK, OWN, {})
    expect(tokens(off)).toBe(1)
    expect(off).toContain('진동 횟수 6을 얻음')
    expect(off).toContain('침잠쇄도')
    expect(tokens(render(DONGBAEK, OWN, { matchPlainKeywords: false }))).toBe(1)
  })

  it('REQ-KEYWORDS-007 draws a plain keyword exactly like a [Id] keyword: colour, underline, icon, tooltip trigger', () => {
    const ref = render('[Sinking] 3')
    const plain = render('침잠 3')
    const trigger = (html: string) => html.match(/<span[^>]*keyword-token[^>]*>.*?<\/span><\/span>/)?.[0] ?? ''
    expect(trigger(plain)).not.toBe('')
    // Same markup apart from the game id the [Id] carries.
    expect(trigger(plain)).toBe(trigger(ref).replace(' data-game-ref="Sinking"', ''))
    for (const marker of ['text-decoration-line:underline', 'color:#ff4f42', 'cursor:help', 'tabindex="0"', '<img']) expect(plain).toContain(marker)
  })

  it('REQ-KEYWORDS-007 finds nothing without the allowed set of the identity, or with an empty one', () => {
    expect(tokens(render('진동 3 부여', null))).toBe(0)
    expect(tokens(render('진동 3 부여', new Set()))).toBe(0)
    expect(tokens(render('진동 3 부여', new Set(['침잠'])))).toBe(0)
    expect(tokens(render('진동 3 부여', new Set(['진동'])))).toBe(1)
  })

  it('REQ-KEYWORDS-007 keeps listed-but-unrelated words plain: 보호막, 소수점 버림 and counted words without their number', () => {
    const all = new Set(Object.keys(KEYWORDS))
    expect(tokens(render('최대 체력의 3%만큼 보호막을 얻음 (소수점 버림)', all))).toBe(0)
    expect(tokens(render('신속하게 움직임, 보호 받는 자', all))).toBe(0)
    expect(tokens(render('다음 턴에 신속 1 얻음', all))).toBe(1)
  })

  it('REQ-KEYWORDS-007 takes 진동 폭발 whole and ranks the identity own skill names before keywords', () => {
    expect(tokens(render('진동 폭발 시 진동 횟수 2 증가', new Set([...OWN, '진동 폭발'])))).toBe(2)
    // 진동 폭발 is not the identity's: it is not cut into 진동 either.
    expect(tokens(render('진동 폭발 시 진동 횟수 2 증가'))).toBe(1)
    const html = render('침잠의 파도 후 침잠 3 부여', OWN, { matchPlainKeywords: true }, { '침잠의 파도': '#112233' })
    expect(html).toContain('color:#112233')
    expect(tokens(html)).toBe(1)
    // Without that skill name the first 침잠 (followed by the particle 의) would be a keyword too.
    expect(tokens(render('침잠의 파도 후 침잠 3 부여'))).toBe(2)
  })

  it('REQ-KEYWORDS-007 never searches inside a [Id], a <link> or a quotation', () => {
    expect(tokens(render('<link="Sinking">침잠 3</link>'))).toBe(1)
    expect(tokens(render("‘침잠쇄도’ 발동 후 침잠 2 부여"))).toBe(1)
    expect(render("‘침잠쇄도’ 발동")).toContain('‘침잠쇄도’')
  })

  it('REQ-KEYWORDS-007 keeps gold numbers (tooltips) and does not touch the coin label', () => {
    const tooltip = render('침잠 3 부여', OWN, { matchPlainKeywords: true, highlightValues: '#123456' })
    expect(tokens(tooltip)).toBe(1)
    expect(tooltip).toMatch(/<b style="color:#e8b030;font-weight:700">3<\/b>/)
    const coin = render('<coin=1>진동 3 부여</coin>')
    expect(coin).toContain('identity.skills.coin')
    expect(tokens(coin)).toBe(1)
  })

  it('REQ-KEYWORDS-007 reads English names as whole words and Japanese names after a non-letter, per language', () => {
    currentLocale = 'en'
    try {
      expect(tokens(render('Inflict 3 Sinking and 2 Haste', new Set(['침잠', '신속'])))).toBe(2)
      expect(tokens(render('Sinking in haste, Protection', new Set(['침잠', '신속', '보호'])))).toBe(0)
      currentLocale = 'ja'
      expect(tokens(render('沈潜 3を付与\n対象にクイック 1を付与', new Set(['침잠', '신속'])))).toBe(1)
    } finally {
      currentLocale = 'ko'
    }
  })

  it('REQ-KEYWORDS-007 SkillDescription draws plain keywords only when asked, with the allowed set it is given', () => {
    const wrap = (node: React.ReactNode) => renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}>{node}</KeywordProvider>)
    const text = '진동 횟수 6을 얻음\n<coin=1>침잠 횟수 1 증가</coin>'
    expect(tokens(wrap(<SkillDescription description={text} accentColor="#c2b79f" variant="detail" allowedKeywords={OWN} matchPlainKeywords />))).toBe(2)
    expect(tokens(wrap(<SkillDescription description={text} accentColor="#c2b79f" variant="detail" allowedKeywords={OWN} />))).toBe(0)
    expect(tokens(wrap(<SkillDescription description={text} accentColor="#c2b79f" variant="detail" matchPlainKeywords />))).toBe(0)
  })
})

describe('REQ-KEYWORDS-010 a keyword description draws the keywords it names', () => {
  const keywordText = (text: string, options: Options = {}) =>
    render(text, keywordTextAllowed('신속'), { highlightValues: '#e8b030', matchPlainKeywords: true, keywordText: true, ...options })

  it('REQ-KEYWORDS-010 draws the battle keywords of a keyword description, but not the keyword it describes', () => {
    const html = keywordText('- 신속 1당 진동 위력 +1, 침잠 횟수 2')
    expect(tokens(html)).toBe(2)
    expect(html).toContain('>진동<')
    expect(html).toContain('>침잠<')
  })

  it('REQ-KEYWORDS-010 a keyword inside a tooltip opens its own tooltip too', () => {
    // a keyword description is what a tooltip draws: its keywords are live too (tooltip-stack keeps the outer one open)
    const inside = keywordText('진동 위력 +1')
    expect(tokens(inside)).toBe(1)
    expect(inside).toContain('<img')
    expect(inside).toContain('tabindex="0"')
    expect(inside).toContain('cursor:help')
    expect(render('[Sinking] 3', OWN)).toContain('tabindex="0"')
  })

})

import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatGameText, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const ACCENT = '#abcdef'
const REFS: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
  // A tag with no colour of its own in the site tables: it takes the caller's accent.
  Unlisted_Tag: { k: 'skilltag', n: '[이름없는 태그]' },
}

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({
  default: (key: string | null) => ({ data: key?.startsWith('/api/game-text-refs/') ? REFS : undefined }),
  preload: () => Promise.resolve(),
}))

const KEYWORDS: Record<string, KeywordInfo> = { 화상: { desc: '', iconSlug: 'burn', effectType: 'negative' } }

type Format = ReturnType<typeof useFormatSkillDesc>
type FormatArgs = Parameters<Format> extends [unknown, unknown, ...infer Rest] ? Rest : never
function Formatter({ text, args }: { text: string; args: FormatArgs }) {
  const format = useFormatSkillDesc()
  return <>{format(text, ACCENT, ...args)}</>
}
const render = (text: string, ...args: FormatArgs) =>
  renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Formatter text={text} args={args} /></KeywordProvider>)

describe('REQ-SHARED-022 game text body is the default colour', () => {
  it('REQ-SHARED-022 does not wrap the body in the caller accent colour: plain text and styled text inherit', () => {
    expect(render('본문 한 줄')).toBe('<span>본문 한 줄</span>')
    const html = render('본문 <b>굵게</b> 끝')
    expect(html).not.toContain(ACCENT)
    expect(html).not.toContain('color:')
  })

  it('REQ-SHARED-022 renders <color=…> children without the colour', () => {
    const html = render('앞 <color=#ff6000>주황</color> 뒤')
    expect(html).toContain('주황')
    expect(html).not.toContain('#ff6000')
    expect(html).not.toContain('color:')
    expect(html).not.toContain('&lt;')
  })

  it('REQ-SHARED-022 renders highlight and upgradeHighlight styles without a colour', () => {
    const html = render('<style="highlight">강조</style> <style="upgradeHighlight">강화</style>')
    expect(html).toContain('강조')
    expect(html).toContain('강화')
    expect(html).not.toContain('color:')
    expect(html).not.toContain('#f8c200')
    expect(html).not.toContain('#ff9000')
    expect(html).not.toContain('&lt;')
    expect(html).not.toContain('style=&quot;')
  })

  it('REQ-SHARED-022 renders <mark> children without a background', () => {
    const html = render('<mark=#ff000040>형광</mark> 끝')
    expect(html).toContain('형광')
    expect(html).not.toContain('background')
    expect(html).not.toContain('#ff000040')
    expect(html).not.toContain('&lt;')
  })

  it('REQ-SHARED-022 keeps underline, bold, italic, strikethrough and size inside the dropped colour tags', () => {
    const html = render('<color=#ff6000><b>굵은 색</b></color><style="highlight"><u>밑줄 강조</u></style><size=150%>큼</size>')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('text-decoration:underline')
    expect(html).toContain('font-size:150%')
    expect(html).not.toContain('color:')
  })

  it('REQ-SHARED-022 keeps the keyword colour and icon of a keyword ref and the condition colour of a skill tag', () => {
    const html = render('<style="highlight">[OnSucceedAttack] [Combustion] 3 부여</style>')
    expect(html).toContain('color:#93f13e')
    expect(html).toContain('>[적중시]<')
    expect(html).toContain('color:#ff4f42')
    expect(html).toContain('<img')
    expect(html).not.toContain(ACCENT)
  })

  it('REQ-SHARED-022 uses the accent only for a skill tag whose own colour is the default', () => {
    const html = render('[Unlisted_Tag] 본문')
    expect(html).toMatch(new RegExp(`<span style="color:${ACCENT};font-weight:600">\\[이름없는 태그\\]</span> 본문`))
    expect(html.match(new RegExp(ACCENT, 'g'))).toHaveLength(1)
  })

  it('REQ-SHARED-022 uses the accent for the coin label only, not for the coin body', () => {
    const html = render('본문\n<coin=1>[Combustion] 3 <b>부여</b></coin>')
    expect(html).toContain(`<span style="color:${ACCENT};font-weight:600">[identity.skills.coin 1] </span>`)
    expect(html.match(new RegExp(ACCENT, 'g'))).toHaveLength(1)
  })

  it('REQ-SHARED-022 colours only the matched skill names, not the line around them', () => {
    const html = render('벼락치기 후 일반 글자', { 벼락치기: '#ff0000' })
    expect(html).toMatch(/<span style="color:#ff0000;font-weight:600">벼락치기<\/span>/)
    expect(html).not.toContain(ACCENT)
    expect(html.match(/color:/g)).toHaveLength(1)
  })

  it('REQ-SHARED-022 tints only the numbers and Potency/Count terms of a tooltip, not the line', () => {
    const html = render('위력 +3 증가 그리고 일반 글자', undefined, undefined, { highlightValues: '#123456' })
    expect(html).toMatch(/<b style="color:#e8b030;font-weight:700">\+3<\/b>/)
    expect(html).toContain('color:#123456;font-weight:600">위력<')
    expect(html).not.toContain(ACCENT)
    expect(html.match(/color:/g)).toHaveLength(2)
  })

  it('REQ-SHARED-022 flavor and keyword descriptions (useFormatGameText) are not tinted by the caller colour either', () => {
    function Flavor() {
      const format = useFormatGameText()
      return <>{format('<color=#ff6000>풍미</color> <b>글</b>', ACCENT)}</>
    }
    const html = renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Flavor /></KeywordProvider>)
    expect(html).toContain('풍미')
    expect(html).not.toContain('color:')
  })

  it('REQ-SHARED-022 no longer exports the dropped highlight colours', () => {
    const source = readFileSync('components/game-text/GameText.tsx', 'utf8')
    expect(source).not.toContain('GAME_TEXT_HIGHLIGHT')
    expect(source).not.toContain('GAME_TEXT_UPGRADE_HIGHLIGHT')
    expect(source).not.toContain('backgroundColor')
  })
})

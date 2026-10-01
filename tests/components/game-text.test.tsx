import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, resolveKeywordIconUrl, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import { GAME_TEXT_HIGHLIGHT, GAME_TEXT_UPGRADE_HIGHLIGHT } from '@/components/game-text/GameText'
import type { GameTextRefNames } from '@/lib/db/game-text-refs'

const REFS: GameTextRefNames = {
  Combustion: { k: 'keyword', n: '화상', kw: '화상' },
  Burst: { k: 'keyword', n: '폭발', kw: '폭발' },
  CalcValue: { k: 'keyword', n: '계산값' },
  OnSucceedAttack: { k: 'skilltag', n: '[적중시]' },
  // The id and the label colour differ in the game's tables: the Force variant of "전투 시작시" is green, the label blue.
  StartBattle_Force: { k: 'skilltag', n: '[전투 시작시]' },
}
const DESCRIPTIONS: Record<string, string> = { CalcValue: '게임 설명' }

const MESSAGES: Record<string, { identity: { skills: { coin: string } } }> = {
  ko: JSON.parse(readFileSync('messages/ko.json', 'utf8')),
  en: JSON.parse(readFileSync('messages/en.json', 'utf8')),
  ja: JSON.parse(readFileSync('messages/ja.json', 'utf8')),
}
let currentLocale = 'ko'
vi.mock('next-intl', () => ({
  useLocale: () => currentLocale,
  useTranslations: () => (key: string) =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], MESSAGES[currentLocale]) ?? key,
}))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
const requestedKeys: (string | null)[] = []
vi.mock('swr', () => ({
  default: (key: string | null) => (requestedKeys.push(key), {
    data: key?.includes('part=descriptions') ? DESCRIPTIONS : key?.startsWith('/api/game-text-refs/') ? REFS : undefined,
  }),
  preload: () => Promise.resolve(),
}))

const KEYWORDS: Record<string, KeywordInfo> = {
  화상: { desc: '', iconSlug: 'burn', effectType: 'negative' },
  폭발: { desc: '', iconSlug: 'burst' },
}

type FormatOptions = Parameters<ReturnType<typeof useFormatSkillDesc>>[4]
function Formatter({ text, options }: { text: string; options?: FormatOptions }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#abcdef', undefined, undefined, options)}</>
}
const render = (text: string, options?: FormatOptions) =>
  renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Formatter text={text} options={options} /></KeywordProvider>)

describe('REQ-SHARED-019 game text rendering', () => {
  it('REQ-SHARED-019 draws the game highlight and upgrade highlight colours, not the tags', () => {
    const html = render('<style="highlight">강조</style> <style="upgradeHighlight">강화</style>')
    expect(html).toContain(`color:${GAME_TEXT_HIGHLIGHT}`)
    expect(html).toContain(`color:${GAME_TEXT_UPGRADE_HIGHLIGHT}`)
    expect(html).not.toContain('&lt;')
    expect(html).not.toContain('style=&quot;')
  })

  it('REQ-SHARED-019 draws colour, underline, bold, italic, strikethrough and mark', () => {
    const html = render('<color=#ff6000>색</color><u>밑줄</u><b>굵게</b><i>기울임</i><s>취소</s><mark=#ff000040>형광</mark>')
    expect(html).toMatch(/<span style="color:#ff6000">색<\/span>/)
    expect(html).toContain('text-decoration:underline')
    expect(html).toContain('font-weight:700')
    expect(html).toContain('font-style:italic')
    expect(html).toContain('text-decoration:line-through')
    expect(html).toContain('background-color:#ff000040')
    expect(html).not.toContain('&lt;')
  })

  it('REQ-SHARED-019 sizes text by percent, by the TextMeshPro base of 36 for bare numbers, and hides size 0', () => {
    expect(render('<size=150%>큼</size>')).toContain('font-size:150%')
    expect(render('<size=18>작음</size>')).toContain('font-size:0.5em')
    expect(render('<size=72>큼</size>')).toContain('font-size:2em')
    expect(render('<size=1>아주 작음</size>')).toContain('font-size:0.5em')
    expect(render('<size=0%>숨김</size>보임')).not.toContain('숨김')
    expect(render('<size=0%>숨김</size>보임')).toContain('보임')
  })

  it('REQ-SHARED-019 draws a matched keyword ref as a coloured localized name with a tooltip trigger', () => {
    const html = render('<b>x</b> [Combustion] 3 부여')
    expect(html).toContain('keyword-token')
    expect(html).toContain('color:#e30000')
    expect(html).toContain('>화상<')
    expect(html).toContain(resolveKeywordIconUrl('화상', 'burn')!.split('/').pop()!)
    expect(html).not.toContain('[Combustion]')
  })

  it('REQ-SHARED-019 draws a keyword ref without a keyword_meta row in the keyword colour with its own tooltip trigger', () => {
    const html = render('<b>x</b> [CalcValue]')
    expect(html).toContain('data-game-ref="CalcValue"')
    expect(html).toContain('color:#e8dcc8')
    expect(html).toContain('>계산값<')
    expect(html).not.toContain('[CalcValue]')
  })

  it('REQ-SHARED-019 gives a keyword ref without a keyword_meta row the shared keyword tooltip trigger, opened only on demand', () => {
    requestedKeys.length = 0
    const html = render('<b>x</b> [CalcValue]')
    const trigger = html.match(/<span[^>]*data-game-ref="CalcValue"[^>]*>/)?.[0]
    expect(trigger).toContain('class="inline keyword-token')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('cursor:help')
    expect(html).not.toContain('<img')
    expect(requestedKeys.filter(key => key?.includes('part=descriptions'))).toEqual([])
  })

  it('REQ-SHARED-019 draws a skill tag ref as its localized label in the condition colour', () => {
    const html = render('[OnSucceedAttack] <b>x</b>')
    expect(html).toContain('color:#93f13e')
    expect(html).toContain('>[적중시]<')
    expect(html).not.toContain('OnSucceedAttack')
  })

  it('REQ-SHARED-019 colours a skill tag by its id before its label (StartBattle_Force is green, its label blue)', () => {
    const html = render('[StartBattle_Force] <b>x</b>')
    expect(html).toContain('color:#93f13e')
    expect(html).not.toContain('color:#26cfff')
    expect(html).toContain('>[전투 시작시]<')
  })

  it('REQ-SHARED-019 draws a sprite as the keyword icon and a link as a plain tooltip wrapper without icon or colour', () => {
    const sprite = render('<sprite name="Burst">폭발')
    expect(sprite).toContain('<img')
    expect(sprite).toContain(resolveKeywordIconUrl('폭발', 'burst')!.split('/').pop()!)
    expect(sprite).not.toContain('&lt;')

    const link = render('<link="Combustion">화상 효과</link> 끝')
    expect(link).toContain('keyword-token')
    expect(link).toContain('화상 효과')
    expect(link).not.toContain('<img')
    expect(link).not.toContain('#e30000')

    expect(render('<sprite name="Unknown">남음')).not.toContain('<img')
  })

  it('REQ-SHARED-019 draws numbered slots and site tokens as labels and keeps named slots as text', () => {
    const html = render('<b>x</b> {0} {1:F1} {{live}} {amount}')
    expect(html.match(/data-placeholder="value"/g)).toHaveLength(2)
    expect(html).toContain('data-placeholder="live"')
    expect(html).toContain('{amount}')
    expect(html).not.toContain('{0}')
  })

  it('REQ-SHARED-019 keeps an unknown ref literal and does not guess keywords in plain text', () => {
    const html = render('<b>화상 3</b> 폭발 [Conbustion] [사용시]')
    expect(html).toContain('[Conbustion]')
    expect(html).toContain('[사용시]')
    expect(html).not.toContain('keyword-token')
    expect(html).not.toContain('color:#e30000')
  })

  it('REQ-SHARED-019 draws old-format text through the previous path (keywords guessed, brackets coloured)', () => {
    const html = render('[사용시] 화상 3 부여')
    expect(html).toContain('keyword-token')
    expect(html).toContain('color:#e30000')
    expect(html).toContain('color:#26cfff')
    expect(html).not.toContain('data-game-ref')
  })

  it('REQ-SHARED-019 keeps user notes (escapeKeywords) on the previous path even when they hold game tags and refs', () => {
    const html = render('<b>굵게</b> [Combustion] 화상', { escapeKeywords: true })
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('font-weight:700')
    expect(html).not.toContain('data-game-ref')
  })

  it('REQ-SHARED-019 GameText does not import the keyword provider (no module cycle: the provider hands it the tooltip component)', () => {
    const source = readFileSync('components/game-text/GameText.tsx', 'utf8')
    expect(source).not.toMatch(/from '@\/components\/providers\/KeywordProvider'/)
  })

  it('REQ-SHARED-019 uses the base colour for text outside any style', () => {
    expect(render('<b>굵게</b> 일반')).toContain('color:#abcdef')
  })

  describe('<coin=N> blocks', () => {
    const raw = '[OnSucceedAttack] 본문\n<coin=1>[Combustion] 3 부여</coin>\n<coin=2><b>둘째</b></coin>'

    it('REQ-SHARED-019 draws each coin as a block with its own label in the accent colour and the children after it', () => {
      currentLocale = 'ko'
      const html = render(raw)
      expect(html).toMatch(/<div[^>]*><span style="color:#abcdef;font-weight:600">\[코인 1\] <\/span>.*keyword-token.*<\/div>/)
      expect(html).toContain('[코인 2]')
      expect(html).toContain('font-weight:700')
      expect(html.match(/<div/g)).toHaveLength(2)
      // The line breaks around a block would only add empty lines, so they are not drawn.
      expect(html).not.toMatch(/\n<div|<\/div>\n/)
      expect(html).toContain('본문<div')
      expect(html).not.toContain('&lt;coin')
    })

    it('REQ-SHARED-019 labels coins [Coin N] in English and [コイン N] in Japanese', () => {
      currentLocale = 'en'
      expect(render('<coin=1>a</coin>')).toContain('[Coin 1]')
      currentLocale = 'ja'
      expect(render('<coin=3>a</coin>')).toContain('[コイン 3]')
      currentLocale = 'ko'
    })

    it('REQ-SHARED-019 keeps the main description before the coin blocks and draws the legacy [코인 N] form as before', () => {
      currentLocale = 'ko'
      const html = render(raw)
      expect(html.indexOf('본문')).toBeLessThan(html.indexOf('[코인 1]'))
      const legacy = render('[사용시] 화상 3 부여\n[코인 1] 폭발 1')
      expect(legacy).not.toContain('<div')
    })
  })
})

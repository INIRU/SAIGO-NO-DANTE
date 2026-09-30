import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'
import PlaceholderLabel, { PlaceholderGiftProvider, PlaceholderText } from '@/components/ui/PlaceholderLabel'
import { KeywordProvider, useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import { colorizeEventText } from '@/lib/utils/event-text'
import { PLACEHOLDER_LABELS, PLACEHOLDER_TOKENS, placeholdersToPlainText, type PlaceholderLocale } from '@/lib/game-text/placeholders'

vi.mock('next/image', () => ({ default: (props: { src: string; alt: string; className?: string }) => <img src={props.src} alt={props.alt} className={props.className} /> }))

const MESSAGES = { ko, en, ja }

function render(node: ReactNode, locale: PlaceholderLocale = 'ko') {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>{node}</NextIntlClientProvider>)
}

function Formatted({ text }: { text: string }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#fff')}</>
}
const formatted = (text: string, locale: PlaceholderLocale = 'ko') =>
  render(<KeywordProvider keywords={{ 화상: { desc: '' } }}><Formatted text={text} /></KeywordProvider>, locale)

describe('REQ-MIRROR-DUNGEON-010 placeholder labels', () => {
  it('uses the same wording in messages and in plain-text labels, for every token and language', () => {
    for (const locale of ['ko', 'en', 'ja'] as const) {
      for (const token of PLACEHOLDER_TOKENS) {
        expect(MESSAGES[locale].placeholder[token]).toBe(PLACEHOLDER_LABELS[locale][token])
        expect(MESSAGES[locale].placeholder.hint[token]).toBeTruthy()
      }
    }
  })

  it('draws each token as a chip marked with its kind, in the page language', () => {
    expect(render(<PlaceholderLabel token="live" />)).toContain('data-placeholder="live"')
    expect(render(<PlaceholderLabel token="live" />)).toContain('게임 중 표시')
    expect(render(<PlaceholderLabel token="live" />, 'en')).toContain('Shown in game')
    expect(render(<PlaceholderLabel token="live" />, 'ja')).toContain('ゲーム中に表示')
    expect(render(<PlaceholderLabel token="potency" />, 'en')).toContain('Potency')
    expect(render(<PlaceholderLabel token="count" />, 'ja')).toContain('回数')
    expect(render(<PlaceholderLabel token="sinner" />)).toContain('수감자 이름')
    // Live, sinner and target carry an icon; potency and count only a tint.
    expect(render(<PlaceholderLabel token="target" />)).toMatch(/<svg[^>]*aria-hidden="true"/)
    expect(render(<PlaceholderLabel token="potency" />)).not.toContain('<svg')
    expect(render(<PlaceholderLabel token="value" />)).toContain('title="게임이 채우는 값"')
  })

  it('shows a {{gift:<id>}} as the gift the page knows, as a button when it can open it', () => {
    const lookup = (id: number) => id === 9228 ? { name: '신검합일', image_url: 'https://x/9228.webp', onClick: () => {} } : undefined
    const html = render(<PlaceholderGiftProvider lookup={lookup}><PlaceholderText text={'변경됨\n{{gift:9228}}'} /></PlaceholderGiftProvider>)
    expect(html).toContain('<button type="button" data-placeholder="gift"')
    expect(html).toContain('신검합일')
    expect(html).toContain('src="https://x/9228.webp"')
    // Without a lookup (or an unknown id) the chip falls back to the generic label.
    expect(render(<PlaceholderText text="{{gift:1}}" />, 'en')).toContain('E.G.O Gift')
  })
})

describe('REQ-MIRROR-DUNGEON-010 text renderers', () => {
  it('skill, passive, keyword and gift descriptions draw tokens next to keyword highlighting', () => {
    const html = formatted('{{count}}턴 동안 턴 종료 시 {{potency}}만큼 화상 피해 (현재 {{live}}%)')
    expect(html.match(/data-placeholder=/g)).toHaveLength(3)
    expect(html).toContain('keyword-token')
    expect(html).not.toContain('{{')
    // A non-token {{ stays text and does not hide the token after it.
    expect(formatted('{{nope}}{{value}}')).toContain('{{nope}}')
    expect(formatted('{{nope}}{{value}}')).toContain('data-placeholder="value"')
  })

  it('keeps old DB text readable: filled "(수치)" wording and "→ [name]" stay as text', () => {
    const html = formatted('피해량이 (수치)%만큼 증가\n→ [신검합일]')
    expect(html).toContain('(수치)')
    expect(html).not.toContain('data-placeholder')
  })

  it('event text: stored {{sinner}} and an old bare {0} both become the sinner chip inside colour tags', () => {
    const html = render(<>{colorizeEventText('<color=#e30000>{{sinner}}</color> 수감자와 {0} 수감자')}</>)
    expect(html.match(/data-placeholder="sinner"/g)).toHaveLength(2)
    expect(html).toContain('color:#e30000')
  })

  it('plain text writes tokens as labels and gifts by name when known', () => {
    expect(placeholdersToPlainText('(현재 {{live}}%) {{gift:9228}}', 'ko', id => id === 9228 ? '신검합일' : null)).toBe('(현재 (게임 중 표시)%) [신검합일]')
    expect(placeholdersToPlainText('{{gift:9228}}', 'en')).toBe('(E.G.O Gift)')
  })
})

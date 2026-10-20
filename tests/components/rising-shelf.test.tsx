import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ swr: {} as { data?: unknown; error?: Error } }))

vi.mock('swr', () => ({ default: () => state.swr }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('@/components/ui/IdentityFrameCard', () => ({ default: ({ name }: { name: string }) => <span data-identity="true">{name}</span> }))
vi.mock('@/components/decks/DeckCard', () => ({ default: ({ deck }: { deck: { id: string } }) => <span data-deck="true">{deck.id}</span> }))
vi.mock('@/components/planner/PlanCard', () => ({ default: ({ plan }: { plan: { id: string } }) => <span data-plan="true">{plan.id}</span> }))

import RisingShelf from '@/components/discovery/RisingShelf'

const identity = (id: string) => ({ id, sinner_id: 'yisang', name_kr: `인격${id}`, name_en: null, name_jp: null, rarity: 3, folder_name: 'x', game_id: '10101' })
const feed = { posts: [{ post: { id: 'a' }, rise: 2.4 }, { post: { id: 'b' }, rise: 1.8 }], identities: [{ identity: identity('i1'), rise: 3.1 }] }
const render = (kind: 'deck' | 'planner' = 'deck') => renderToStaticMarkup(<RisingShelf kind={kind} />)

beforeEach(() => { state.swr = { data: feed } })

describe('RisingShelf', () => {
  it('REQ-COMMUNITY-074 shows the title, the rising identities and the board posts, each with its rise', () => {
    const html = render()
    expect(html).toContain('data-shelf="rising"')
    expect(html).toContain('>rising<')
    expect(html).toContain('href="/sinners/yisang/identities/i1"')
    expect(html).toContain('<span data-deck="true">a</span>')
    for (const rise of ['×2.4', '×1.8', '×3.1']) expect(html).toContain(`>${rise}<`)
    expect(html).not.toContain('data-plan')
  })

  it('REQ-COMMUNITY-074 shows plan cards on the plan board', () => {
    expect(render('planner')).toContain('<span data-plan="true">a</span>')
  })

  it('REQ-COMMUNITY-074 draws nothing while loading, on a failed read, or with fewer than two rising', () => {
    state.swr = {}
    expect(render()).toBe('')
    state.swr = { error: new Error('503') }
    expect(render()).toBe('')
    state.swr = { data: { posts: [], identities: [] } }
    expect(render()).toBe('')
    state.swr = { data: { posts: [{ post: { id: 'a' }, rise: 2.4 }], identities: [] } }
    expect(render()).toBe('')
    state.swr = { data: { recent: [], popular: [] } }
    expect(render()).toBe('')
  })
})

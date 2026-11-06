import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string, values?: Record<string, unknown>) => key + (values ? JSON.stringify(values) : '') }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))
vi.mock('@/features/catalog/components/IdentityFrameCard', () => ({ default: ({ name }: { name: string }) => <span data-identity="true">{name}</span> }))
vi.mock('@/features/catalog/components/EgoDisplayCard', () => ({ default: ({ name }: { name: string }) => <span data-ego="true">{name}</span> }))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywords: () => ({}), useKeywordData: () => ({ getIconUrl: () => null }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>, useRouter: () => ({}), usePathname: () => '/' }))

import { PlannerEgoSelectModal, PlannerIdentitySelectModal } from '@/components/planner/deck/PlannerDeckSelection'
import type { Suggestion } from '@/features/community/lib/suggestion-types'

const sinner = { id: 'faust', name_kr: '파우스트' }
const identity = (id: string, name: string, sinner_id = 'faust') => ({ id, sinner_id, name_kr: name, rarity: 3, game_id: '10201', folder_name: name })
const identities = [identity('i1', '가'), identity('i2', '나')]
const all = new Map([...identities, identity('p1', '동료1', 'yisang'), identity('p2', '동료2', 'ishmael'), identity('p3', '동료3', 'sinclair'), identity('p4', '동료4', 'outis')].map(item => [item.id, item]))
const full: Suggestion = { id: 'i1', score: 3, reasons: ['keyword:출혈', 'faction:거미집'], partners: [
  { id: 'p1', score: 3, chosen: true }, { id: 'p2', score: 2, chosen: false }, { id: 'p3', score: 1, chosen: false }, { id: 'p4', score: 1, chosen: false }] }
const render = (suggestions: Suggestion[] | undefined, archetype?: { keywords: string[]; factions: string[] }) => renderToStaticMarkup(
  <PlannerIdentitySelectModal open sinner={sinner} identities={identities} suggestions={suggestions} archetype={archetype} partnerIdentity={id => all.get(id)} onClose={() => {}} onSelect={() => {}} />,
)

describe('identity picker suggestion note', () => {
  it('REQ-DECKS-032 shows up to three partner faces with the "pairs with" label and a one-line reason under the suggested card', () => {
    const html = render([full])
    expect(html).toContain('data-suggestion-note')
    expect(html).toContain('pairsWith')
    expect(html.match(/data-partner-face/g)).toHaveLength(3)
    expect(html).toContain('출혈 · 거미집')
    expect(html).toContain('aria-label="동료1"')
    expect(html).not.toContain('동료4')
  })

  it('REQ-DECKS-032 rings a partner already on the board in gold and the others in the border colour', () => {
    const html = render([full])
    expect(html.match(/data-chosen="true"/g)).toHaveLength(1)
    expect(html.match(/data-chosen="false"/g)).toHaveLength(2)
  })

  it('REQ-DECKS-032 leaves the note out when the suggestion has no partners or reasons, and keeps the rest', () => {
    const html = render([{ id: 'i1' }])
    expect(html).not.toContain('data-suggestion-note')
    expect(html).toContain('>label<')
  })

  it('REQ-DECKS-032 skips a partner the catalogue does not know', () => {
    const html = render([{ id: 'i1', partners: [{ id: 'ghost', score: 1, chosen: false }, { id: 'p1', score: 1, chosen: false }] }])
    expect(html.match(/data-partner-face/g)).toHaveLength(1)
  })

  it('REQ-DECKS-033 names the archetype beside the ribbon from its keywords, or its affiliation when it has none', () => {
    expect(render([full], { keywords: ['출혈', '진동', '충전'], factions: [] })).toContain('archetype{&quot;name&quot;:&quot;출혈, 진동&quot;}')
    // With no keyword standing out, the affiliation names the archetype.
    expect(render([full], { keywords: [], factions: ['거미집'] })).toContain('archetype{&quot;name&quot;:&quot;거미집&quot;}')
    expect(render([full], { keywords: [], factions: [] })).not.toContain('archetype{')
    expect(render([full])).not.toContain('archetype{')
  })

  it('REQ-DECKS-034 turns a sin code into its resonance label and drops codes it cannot read', () => {
    const html = render([{ id: 'i1', reasons: ['sin:wrath', 'unknown'] }])
    expect(html).toContain('sinResonance')
    expect(html).not.toContain('unknown')
  })
})

describe('E.G.O picker suggestion note', () => {
  const egos = [{ id: 'e1', sinner_id: 'faust', name: '에고', name_kr: '에고', grade: 'WAW' }]
  const render = (suggestions: Suggestion[] | undefined, archetype?: { keywords: string[]; factions: string[] }) => renderToStaticMarkup(
    <PlannerEgoSelectModal open sinner={sinner} egos={egos} selectedEgosByGrade={{}} suggestions={suggestions} archetype={archetype} partnerIdentity={id => all.get(id)} onClose={() => {}} onSelect={() => {}} onDeselect={() => {}} />,
  )

  it('REQ-DECKS-035 shows the same note and archetype under a suggested E.G.O', () => {
    const html = render([{ id: 'e1', reasons: ['keyword:출혈'], partners: [{ id: 'p1', score: 1, chosen: true }] }], { keywords: ['출혈'], factions: [] })
    expect(html).toContain('data-suggestion-note')
    expect(html).toContain('archetype{')
    expect(html).toContain('출혈')
  })

  it('REQ-DECKS-035 draws a plain suggestion (id only) without a note', () => {
    const html = render([{ id: 'e1' }])
    expect(html).not.toContain('data-suggestion-note')
    expect(html).toContain('>label<')
  })
})

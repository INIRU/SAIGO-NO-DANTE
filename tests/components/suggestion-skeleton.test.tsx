import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const swr = vi.hoisted(() => ({ result: {} as { data?: unknown; error?: unknown } }))
vi.mock('swr', () => ({ default: () => swr.result }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))
vi.mock('@/components/cards/IdentityFrameCard', () => ({ default: ({ name }: { name: string }) => <span data-identity>{name}</span> }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>, useRouter: () => ({}), usePathname: () => '/' }))
vi.mock('@/components/cards/EgoDisplayCard', () => ({ default: ({ name }: { name: string }) => <span data-ego>{name}</span> }))
vi.mock('@/components/cards/CardSkeleton', () => ({ CardSkeleton: ({ kind }: { kind: string }) => <div data-card-skeleton={kind} /> }))

import { useSuggestionState } from '@/hooks/useSuggestions'
import { SuggestionGroupSkeleton, GiftGroupSkeleton, IdentityTileSkeleton } from '@/components/ui/SuggestionSkeleton'
import { RecommendationLaneSkeleton, IdentityRecommendationsSkeleton } from '@/features/decks/components/RecommendationSkeleton'
import { ThemePackPickerModal } from '@/components/ui/ThemePackModal'
import { PlannerEgoSelectModal, PlannerIdentitySelectModal } from '@/features/decks/components/PlannerDeckSelection'
import FloorGiftPickerModal from '@/features/planner/components/FloorGiftPickerModal'

const count = (html: string, needle: string) => html.split(needle).length - 1
const sinner = { id: 'faust', name_kr: '파우스트' }
const identity = (id: string, name: string) => ({ id, sinner_id: 'faust', name_kr: name, rarity: 3, game_id: '10201', folder_name: name })
const identities = [identity('i1', '가'), identity('i2', '나')]

describe('loading state of the suggestions', () => {
  it('is loading from the first ask until the answer or the failure, never without a url', () => {
    swr.result = {}
    expect(useSuggestionState('/api/discovery/suggest?x')).toEqual({ data: null, loading: true })
    expect(useSuggestionState(null)).toEqual({ data: null, loading: false })
    swr.result = { error: new Error('500') }
    expect(useSuggestionState('/api/discovery/suggest?x')).toEqual({ data: null, loading: false })
    swr.result = { data: { items: [] } }
    expect(useSuggestionState('/api/discovery/suggest?x')).toEqual({ data: { items: [] }, loading: false })
  })
})

describe('identity picker', () => {
  const render = (props: { suggestionsLoading?: boolean; suggestions?: { id: string }[] }) => renderToStaticMarkup(
    <PlannerIdentitySelectModal open sinner={sinner} identities={identities} onClose={() => {}} onSelect={() => {}} {...props} />,
  )

  it('holds the suggestion group while it loads: the ribbon bar, six cards, each with partner faces and a reason line', () => {
    const html = render({ suggestionsLoading: true })
    expect(html).toContain('data-suggestion-skeleton="identity"')
    expect(html).toContain('role="status"')
    expect(count(html, 'data-tile-skeleton="identity"')).toBe(6)
    expect(count(html, 'data-suggestion-note-skeleton')).toBe(6)
    expect(count(html, 'data-suggestion-title-skeleton')).toBe(1)
    // The real list follows under the group's rule, so it does not move when the group arrives.
    expect(html).toContain('data-group="after-suggested"')
    expect(html).toContain('data-identity')
  })

  it('swaps the skeleton for the group when the suggestions arrive, and leaves nothing when they come back empty', () => {
    const arrived = render({ suggestions: [{ id: 'i2' }] })
    expect(arrived).not.toContain('data-suggestion-skeleton')
    expect(arrived).toContain('>label<')
    const empty = render({})
    expect(empty).not.toContain('data-suggestion-skeleton')
    expect(empty).not.toContain('data-group="after-suggested"')
  })
})

describe('E.G.O picker', () => {
  const egos = [{ id: 'e1', sinner_id: 'faust', name: '자인', name_kr: '자인', grade: 'ZAYIN' }]
  const render = (suggestionsLoading: boolean) => renderToStaticMarkup(
    <PlannerEgoSelectModal open sinner={sinner} egos={egos} selectedEgosByGrade={{}} suggestionsLoading={suggestionsLoading} onClose={() => {}} onSelect={() => {}} onDeselect={() => {}} />,
  )

  it('holds the group with six E.G.O. shapes and their notes while it loads, then lets go', () => {
    const html = render(true)
    expect(html).toContain('data-suggestion-skeleton="ego"')
    expect(count(html, 'data-tile-skeleton="ego"')).toBe(6)
    expect(count(html, 'data-suggestion-note-skeleton')).toBe(6)
    expect(html).toContain('grid grid-cols-2 gap-3 sm:grid-cols-3')
    expect(render(false)).not.toContain('data-suggestion-skeleton')
  })
})

describe('theme pack and gift pickers', () => {
  const themes = [1, 2, 3].map(id => ({ id, name: `팩${id}`, image_url: null, ego_gift_ids: [], floor_info: null }))
  const theme = (suggestionsLoading: boolean, suggested?: { id: number; count: number }[]) => renderToStaticMarkup(
    <ThemePackPickerModal title="5층" closeLabel="닫기" emptyLabel="없음" searchLabel="검색" noResultsLabel="결과 없음"
      countLabel={n => `${n}개`} themes={themes} suggested={suggested} suggestionsLoading={suggestionsLoading} onClose={() => {}} onSelectTheme={() => {}} lang="ko" />,
  )

  it('holds the theme pack group with the ribbon bar and six posters while it loads', () => {
    const html = theme(true)
    expect(html).toContain('data-suggestion-skeleton="theme"')
    expect(html).toContain('aspect-ratio:416 / 684')
    expect(count(html, 'aspect-ratio:416 / 684')).toBe(6)
    expect(html).toContain('팩1')
  })

  it('swaps the poster shapes for the real group, and leaves nothing for an empty answer', () => {
    const arrived = theme(false, [{ id: 3, count: 12 }])
    expect(arrived).not.toContain('data-suggestion-skeleton')
    expect(arrived).toContain('>label<')
    expect(theme(false)).not.toContain('data-suggestion-skeleton')
  })

  it('holds the gift group above the gift list while it loads', () => {
    const gifts = [{ id: '1', game_id: 1, name: '기프트1', keyword: 'Burn', grade: '1', is_synthesis: false, image_url: null }] as never[]
    const render = (suggestionsLoading: boolean) => renderToStaticMarkup(
      <FloorGiftPickerModal open title="5층" floorGifts={gifts} allGifts={gifts} selectedIds={new Set()} suggestionsLoading={suggestionsLoading} onToggle={() => {}} onClose={() => {}} />,
    )
    const loading = render(true)
    expect(loading).toContain('data-suggestion-skeleton="gift"')
    expect(loading).toContain('data-suggestion-title-skeleton')
    expect(render(false)).not.toContain('data-suggestion-skeleton')
  })

  it('draws the group skeleton as a status region with hidden bones, with no grey pulse boxes', () => {
    const html = renderToStaticMarkup(<GiftGroupSkeleton count={8} />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(count(html, 'data-skeleton="true"')).toBeGreaterThanOrEqual(9)
    expect(html).not.toContain('animate-pulse')
  })
})

describe('shapes', () => {
  it('draws the card as 290:428 with a note of three overlapping faces and a reason line', () => {
    const html = renderToStaticMarkup(<IdentityTileSkeleton />)
    expect(html).toContain('aspect-ratio:290 / 428')
    expect(count(html, 'width:1.75rem')).toBe(3)
    expect(renderToStaticMarkup(<IdentityTileSkeleton note={false} />)).not.toContain('data-suggestion-note-skeleton')
  })

  it('puts the group title bar above tiles of a given grid', () => {
    const html = renderToStaticMarkup(<SuggestionGroupSkeleton shape="theme" count={4} tilesClassName="grid grid-cols-3" />)
    expect(count(html, 'aspect-ratio:416 / 684')).toBe(4)
    expect(html.indexOf('data-suggestion-title-skeleton')).toBeLessThan(html.indexOf('aspect-ratio'))
  })
})

describe('recommendation lanes', () => {
  it('draws the lane as a heading, a count and post cards on the lane\'s own grid', () => {
    const html = renderToStaticMarkup(<RecommendationLaneSkeleton kind="planner" />)
    expect(html).toContain('data-recommendation-skeleton')
    expect(html).toContain('flex-wrap')
    expect(html).toContain('flex-[1_1_15rem]')
    expect(count(html, 'data-card-skeleton="planner"')).toBe(3)
    expect(html).toContain('role="status"')
  })

  it('draws the identity page recommendations as the companion row, then the popular lane', () => {
    const html = renderToStaticMarkup(<IdentityRecommendationsSkeleton />)
    expect(count(html, 'aspect-ratio:290 / 428')).toBe(6)
    expect(html).toContain('w-[6.25rem]')
    expect(html).toContain('data-recommendation-skeleton')
    expect(html.indexOf('aspect-ratio:290 / 428')).toBeLessThan(html.indexOf('data-recommendation-skeleton'))
  })
})

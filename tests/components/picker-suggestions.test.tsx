import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))
vi.mock('@/components/ui/IdentityFrameCard', () => ({ default: ({ name }: { name: string }) => <span data-identity>{name}</span> }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>, useRouter: () => ({}), usePathname: () => '/' }))
vi.mock('@/components/sinners/EgoDisplayCard', () => ({ default: ({ name }: { name: string }) => <span data-ego>{name}</span> }))

import GiftCatalog, { useGiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import { ThemePackPickerModal } from '@/components/ui/ThemePackModal'
import { PlannerEgoSelectModal, PlannerIdentitySelectModal } from '@/components/planner/deck/PlannerDeckSelection'

const sinner = { id: 'faust', name_kr: '파우스트' }
const identity = (id: string, name: string) => ({ id, sinner_id: 'faust', name_kr: name, rarity: 3, game_id: '10201', folder_name: name })
const identities = [identity('i1', '가'), identity('i2', '나'), identity('i3', '다')]
const names = (html: string, marker: string) => [...html.matchAll(new RegExp(`<span ${marker}="true">([^<]*)</span>`, 'g'))].map(match => match[1])

const identityModal = (suggestedIds?: string[]) => renderToStaticMarkup(
  <PlannerIdentitySelectModal open sinner={sinner} identities={identities} suggestedIds={suggestedIds} onClose={() => {}} onSelect={() => {}} />,
)

describe('identity picker suggestions', () => {
  it('REQ-DECKS-022 lists the suggested identities first under the ribbon, in the given order, and not again below', () => {
    const html = identityModal(['i3', 'i1'])
    expect(html).toContain('>label<')
    expect(names(html, 'data-identity')).toEqual(['다', '가', '나'])
  })

  it('REQ-DECKS-024 draws no ribbon without suggestions, or for ids the sinner does not have', () => {
    expect(identityModal()).not.toContain('>label<')
    expect(identityModal(['elsewhere'])).not.toContain('>label<')
    expect(names(identityModal(['elsewhere']), 'data-identity')).toEqual(['가', '나', '다'])
  })
})

describe('E.G.O picker suggestions', () => {
  const ego = (id: string, grade: string, name: string) => ({ id, sinner_id: 'faust', name, name_kr: name, grade })
  const egos = [ego('e1', 'ZAYIN', '자인'), ego('e2', 'WAW', '와우')]
  const render = (suggestedIds?: string[]) => renderToStaticMarkup(
    <PlannerEgoSelectModal open sinner={sinner} egos={egos} selectedEgosByGrade={{}} suggestedIds={suggestedIds} onClose={() => {}} onSelect={() => {}} onDeselect={() => {}} />,
  )

  it('REQ-DECKS-023 lists the suggested E.G.O first under the ribbon, and keeps them in their grade rows', () => {
    const html = render(['e2'])
    expect(html).toContain('>label<')
    expect(names(html, 'data-ego')).toEqual(['와우', '자인', '와우'])
  })

  it('REQ-DECKS-024 draws no ribbon without suggestions', () => {
    expect(render()).not.toContain('>label<')
  })
})

describe('theme pack picker suggestions', () => {
  const themes = [1, 2, 3].map(id => ({ id, name: `팩${id}`, image_url: null, ego_gift_ids: [], floor_info: null }))
  const render = (suggested?: { id: number; count: number }[]) => renderToStaticMarkup(
    <ThemePackPickerModal title="5층 테마팩" closeLabel="닫기" emptyLabel="없음" searchLabel="검색" noResultsLabel="결과 없음"
      countLabel={count => `${count}개`} themes={themes} suggested={suggested} onClose={() => {}} onSelectTheme={() => {}} lang="ko" />,
  )

  it('REQ-PLANNER-029 puts the packs similar plans picked first, each with its pick count, and lists them once', () => {
    const html = render([{ id: 3, count: 12 }, { id: 99, count: 5 }])
    expect(html).toContain('>label<')
    expect(html).toContain('>12<')
    expect(html.match(/팩3/g)?.length).toBe(html.match(/팩1/g)?.length)
    expect(html.indexOf('팩3')).toBeLessThan(html.indexOf('팩1'))
  })

  it('REQ-PLANNER-029 draws no ribbon without suggestions or when none of them is offered on the floor', () => {
    expect(render()).not.toContain('>label<')
    expect(render([{ id: 99, count: 5 }])).not.toContain('>label<')
  })
})

describe('gift picker suggestions', () => {
  const gift = (game_id: number, keyword: string) => ({ id: `${game_id}`, game_id, name: `기프트${game_id}`, keyword, grade: '1', is_synthesis: false, image_url: null }) as EgoGift
  const gifts = [gift(1, '공통'), gift(2, '화상'), gift(3, '공통')]
  function Catalog({ pinned }: { pinned?: React.ComponentProps<typeof GiftCatalog>['pinned'] }) {
    return <GiftCatalog gifts={gifts} getGiftKeywordIcon={() => null} filters={useGiftCatalogFilters()} pinned={pinned} onGiftClick={() => {}} />
  }

  it('REQ-PLANNER-030 shows a pinned group marked as the suggestion ribbon before the others, taken gifts first', () => {
    const html = renderToStaticMarkup(<Catalog pinned={[{ ids: new Set(['3']), label: '추천', ribbon: true }]} />)
    expect([...html.matchAll(/<section[^>]*aria-label="([^"]+)"/g)].map(match => match[1])[0]).toBe('추천')
    expect(html.slice(html.indexOf('aria-label="추천"'))).toContain('>label<')
    expect(html.indexOf('기프트3')).toBeLessThan(html.indexOf('기프트1'))
  })

  it('REQ-PLANNER-030 keeps the plain heading for groups that are not the suggestion', () => {
    const html = renderToStaticMarkup(<Catalog pinned={[{ ids: new Set(['3']), label: '최근' }]} />)
    expect(html).toContain('>최근<')
    expect(html).not.toContain('>label<')
  })
})

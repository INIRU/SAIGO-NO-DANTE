import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => [namespace, key].filter(Boolean).join('.') + (values ? JSON.stringify(values) : ''),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }))

import DeckIdentityFilterModal, { type DeckFilterIdentity } from '@/features/decks/components/DeckIdentityFilterModal'

const sinclair = { id: 'sinclair', name_kr: '싱클레어', order_num: 10 }
const faust = { id: 'faust', name_kr: '파우스트', order_num: 2 }
const identity = (id: string, name: string, release_date: string | null, sinner = sinclair, rarity = 3) =>
  ({ id, sinner_id: sinner.id, name, name_kr: name, name_en: null, name_jp: null, rarity, keywords: [], folder_name: null, game_id: null,
    hp: 0, speed_min: 0, speed_max: 0, def_level: 0, tier: 0, release_date, sinner }) as unknown as DeckFilterIdentity
const identities = [
  identity('a', '가 인격', '2023-02-26'),
  identity('b', '하 인격', '2026-10-15', sinclair, 1),
  identity('c', '나 인격', '2024-05-02'),
  identity('d', '파우스트 인격', '2025-01-09', faust),
]
const render = (props: { sinnerId?: string; selected?: string[] } = {}) => renderToStaticMarkup(
  <DeckIdentityFilterModal open sinnerId={props.sinnerId ?? 'sinclair'} sinners={[faust, sinclair]} identities={identities}
    selectedIdentityIds={new Set(props.selected ?? [])} onToggleIdentity={() => {}} onClearIdentities={() => {}} onSinnerChange={() => {}} onClose={() => {}} />,
)
const order = (html: string) => [...html.matchAll(/aria-label="decks\.identityFilter\.(?:add|remove)\{&quot;identity&quot;:&quot;([^&]+)&quot;\}"/g)].map(m => m[1])
const reset = (html: string) => html.match(/<button[^>]*>(?:(?!<button).)*?초기화<\/button>/)?.[0] ?? ''

describe('the board identity filter window', () => {
  it('lists the newest identities first, not by grade and name', () => {
    expect(order(render())).toEqual(['하 인격', '나 인격', '가 인격'])
    expect(order(render({ sinnerId: '' }))).toEqual(['sinner.sinclair 하 인격', 'sinner.faust 파우스트 인격', 'sinner.sinclair 나 인격', 'sinner.sinclair 가 인격'])
  })

  it('offers reset only when there is something in view to clear', () => {
    // Nothing typed, no grade, nothing picked for this sinner: the sinner itself is not something to reset.
    expect(reset(render())).toContain('disabled')
    // A pick of another sinner is outside this view.
    expect(reset(render({ selected: ['d'] }))).toContain('disabled')
    expect(reset(render({ selected: ['c'] }))).not.toContain('disabled')
    expect(reset(render({ sinnerId: '', selected: ['d'] }))).not.toContain('disabled')
  })
})

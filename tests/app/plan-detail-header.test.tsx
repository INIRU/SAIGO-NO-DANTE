import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PlanActions from '@/components/planner/PlanActions'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'ko' }))
vi.mock('@/lib/i18n/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }))

const css = readFileSync(resolve(__dirname, '../../app/[lang]/planner/community/[id]/PlanDetailHeader.module.css'), 'utf8')

const render = (owner: boolean) => renderToStaticMarkup(
  <PlanActions planId="p" planTitle="t" planDescription={null} difficulty="hard" deck={[]} egoSlots={[]} floorPlan={[]} giftInventory={[]} identities={[]} sinners={[]} egos={[]} isOwner={owner} isAdmin={false} />,
)
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map(match => match[1])

it('keys every header console variant on a data-plan-action PlanActions renders, never on icon classes', () => {
  const html = render(true)
  const actions = [...css.matchAll(/\[data-plan-action="([a-z]+)"\]/g)].map(match => match[1])
  expect(new Set(actions)).toEqual(new Set(['assist', 'edit', 'delete', 'copied']))
  // 'copied' only appears after a successful copy; the rest must be in the idle markup.
  for (const action of actions.filter(action => action !== 'copied')) expect(html).toContain(`data-plan-action="${action}"`)
  expect(html).toContain('data-plan-action="copy"')
  expect(html).toContain('data-plan-action="fork"')
  expect(css).not.toMatch(/lucide-/)
})

it('styles the Assist Mode button as the gold primary with a dark label in every pointer state', () => {
  const assist = buttons(render(false)).find(inner => inner.includes('triggerMode'))
  expect(assist).toContain('lucide-play')
  for (const state of ['', ':hover', ':active']) {
    const rule = css.match(new RegExp(`\\.actions button\\[data-plan-action="assist"\\]${state.replace(':', '\\:')} \\{([^}]*)\\}`))?.[1] ?? ''
    expect(rule, `primary${state}`).toMatch(/color: #0d0b08;/)
    expect(rule, `primary${state}`).toMatch(/background: #(c8900a|e8b030|a87808);/)
  }
  // Pressing must not move the button (the old active:translate-y-px).
  expect(css).toMatch(/\.actions button \{[^}]*translate: none;/)
})

it('keeps DOM order = visual order: utilities, then Assist Mode, then owner tools', () => {
  const icons = ['lucide-copy', 'lucide-git-fork', 'lucide-play', 'lucide-pencil', 'lucide-trash-2']
  const order = buttons(render(true)).map(inner => icons.find(icon => inner.includes(`${icon} `) || inner.includes(`${icon}"`)))
  expect(order).toEqual(icons)
  expect(css).not.toMatch(/\border:/)
})

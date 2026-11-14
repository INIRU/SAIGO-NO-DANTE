import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import EmptyState from '@/components/ui/EmptyState'

// The two private copies the plan detail and the planner deck tabs carried before the shared one.
function PlanDetailCopy({ text }: { text: string }) {
  return (
    <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
      {text}
    </p>
  )
}
function DeckTabsCopy({ text }: { text: string }) {
  return (
    <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">{text}</p>
  )
}

describe('EmptyState', () => {
  it('draws the same markup as the copies it replaces', () => {
    for (const text of ['No gifts', '선물이 없습니다', 'a < b & c']) {
      const html = renderToStaticMarkup(<EmptyState text={text} />)
      expect(html).toBe(renderToStaticMarkup(<PlanDetailCopy text={text} />))
      expect(html).toBe(renderToStaticMarkup(<DeckTabsCopy text={text} />))
    }
  })
})

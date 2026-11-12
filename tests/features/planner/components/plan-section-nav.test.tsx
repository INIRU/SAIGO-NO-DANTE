import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PlanSectionNav from '@/features/planner/components/PlanSectionNav'

const sections = [{ id: 'plan-deck', label: '편성' }, { id: 'plan-gifts', label: '기프트' }, { id: 'plan-comments', label: '댓글', count: 3 }]

describe('REQ-PLANNER-056 the section tabs keep their own state', () => {
  it('REQ-PLANNER-056 marks the first section and shows a count', () => {
    const html = renderToStaticMarkup(<PlanSectionNav sections={sections} label="구역" className="nav" />)
    expect(html.match(/aria-current="location"/g)).toHaveLength(1)
    expect(html).toContain('href="#plan-deck" aria-current="location"')
    expect(html).toContain('<span>3</span>')
  })

  it('REQ-PLANNER-056 keeps the current section out of the page component, so scrolling past a section does not redraw every gift', () => {
    const page = readFileSync(join(process.cwd(), 'app/[lang]/planner/community/[id]/PlanDetailClient.tsx'), 'utf8')
    expect(page).not.toContain('setActiveSection')
    expect(page).toContain('<PlanSectionNav')
  })
})

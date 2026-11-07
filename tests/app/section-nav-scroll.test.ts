import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8')
// the declarations of the `.sectionNav ol` rule(s), in one string
const listRule = (source: string) => [...source.matchAll(/\.sectionNav ol\s*\{([^}]*)\}/g)].map(match => match[1]).join(';')

describe('section tabs', () => {
  it.each([
    'app/[lang]/decks/[id]/DeckDetail.module.css',
    'app/[lang]/planner/community/[id]/PlanDetailHeader.module.css',
  ])('REQ-DECKS-054 the tab list of %s scrolls sideways only, so a wheel over it scrolls the page', path => {
    const rule = listRule(css(path))
    // the tabs' underline sits 1px low to cover the bar's border: the list keeps that pixel inside its padding, so nothing
    // overflows downwards and the list never takes a vertical wheel
    expect(rule).toMatch(/overflow-x:\s*auto/)
    expect(rule).toMatch(/overflow-y:\s*hidden/)
    expect(rule).toMatch(/padding-bottom:\s*1px/)
    expect(rule).toMatch(/margin-bottom:\s*-1px/)
  })
})

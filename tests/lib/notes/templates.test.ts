import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { basicTemplate, guideTemplate } from '@/lib/notes/templates'
import { normalizeDocument } from '@/lib/notes/blocks'
import { collectHeadings } from '@/lib/notes/toc'
import { NOTE_TOC_MIN } from '@/lib/notes/toc'

const LANGS = ['ko', 'en', 'ja'] as const
const wrap = (content: JSONContent[]) => ({ type: 'doc', content })
const walk = (nodes: JSONContent[], visit: (n: JSONContent) => void) => nodes.forEach(n => { visit(n); if (n.content) walk(n.content, visit) })

describe('REQ-COMMUNITY-064 note templates', () => {
  it('REQ-COMMUNITY-064 the basic template is the three headings it always was', () => {
    expect(basicTemplate('ko').filter(n => n.type === 'heading').map(n => n.content![0].text)).toEqual(['운용 순서', '핵심 기프트', '대체 편성'])
  })
  it('REQ-COMMUNITY-064 the guide template has enough headings for a table of contents, in every language', () => {
    for (const lang of LANGS) expect(collectHeadings(normalizeDocument(wrap(guideTemplate(lang)))!).length).toBeGreaterThanOrEqual(NOTE_TOC_MIN)
  })
  it('REQ-COMMUNITY-064 the guide template shows the new tools: sin colours, a highlight, empty slots and an accordion', () => {
    for (const lang of LANGS) {
      const types = new Set<string>(), marks = new Set<string>(), slots: string[] = []
      walk(guideTemplate(lang), n => {
        types.add(n.type!)
        n.marks?.forEach(m => marks.add(m.type === 'noteColor' ? `noteColor:${m.attrs!.sin}` : m.type))
        if (n.type === 'noteAsset' && !n.attrs!.id) slots.push(n.attrs!.kind)
      })
      expect(types.has('noteAccordion')).toBe(true)
      expect([...marks].filter(m => m.startsWith('noteColor:')).length).toBeGreaterThanOrEqual(2)
      expect(marks.has('highlight')).toBe(true)
      expect(slots).toEqual(expect.arrayContaining(['identity', 'gift']))
    }
  })
  it('REQ-COMMUNITY-064 every node and mark of the templates passes the saved-document whitelist unchanged', () => {
    for (const lang of LANGS) for (const template of [guideTemplate(lang), basicTemplate(lang)]) {
      expect(normalizeDocument(wrap(template))!.content).toEqual(template)
    }
  })
  it('REQ-COMMUNITY-064 the three languages differ and use the game\'s own sin names', () => {
    const text = (lang: typeof LANGS[number]) => JSON.stringify(guideTemplate(lang))
    expect(text('ko')).not.toBe(text('en'))
    expect(text('ja')).not.toBe(text('en'))
    expect(text('ko')).toContain('분노')
    expect(text('en')).toContain('Wrath')
    expect(text('ja')).toContain('憤怒')
  })
})

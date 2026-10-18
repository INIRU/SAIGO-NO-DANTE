import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NOTE_PREFIX, BLOCK_LABELS, newBlock, normalizeDocument, parseBlockDocument, hasBlocks, visibleNode, type BlockKind } from '@/lib/notes/blocks'
import { tiptapContentToMarkdown } from '@/lib/notes/document'

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text, marks: [] }] })
const doc = (...content: object[]) => ({ type: 'doc', content })
const roundTrip = (d: object) => parseBlockDocument(tiptapContentToMarkdown(d as never))

describe('REQ-COMMUNITY-037 new note blocks', () => {
  it('menu offers the five new blocks with ko/ja/en labels', () => {
    for (const kind of ['callout', 'table', 'checklist', 'divider', 'card'] as BlockKind[]) {
      expect(BLOCK_LABELS[kind]).toHaveLength(3)
      expect(newBlock(kind).type).toBeTruthy()
    }
  })
  it('round trips a callout and falls back to the tip variant for a bad one', () => {
    const d = doc({ type: 'noteCallout', attrs: { variant: 'warning' }, content: [p('주의')] })
    expect(roundTrip(d)?.content?.[0]).toEqual(d.content[0])
    const bad = normalizeDocument(doc({ type: 'noteCallout', attrs: { variant: '<x>' }, content: [p('a')] }))
    expect(bad?.content?.[0].attrs).toEqual({ variant: 'tip' })
  })
  it('round trips a table and drops empty or nested tables', () => {
    const cell = (t: string, type = 'tableCell') => ({ type, attrs: { colspan: 1, rowspan: 1 }, content: [p(t)] })
    const d = doc({ type: 'table', content: [{ type: 'tableRow', content: [cell('a', 'tableHeader'), cell('b', 'tableHeader')] }, { type: 'tableRow', content: [cell('1'), cell('2')] }] })
    expect(roundTrip(d)?.content?.[0]).toEqual(d.content[0])
    expect(normalizeDocument(doc({ type: 'table', content: [] }, p('남음')))?.content).toEqual([p('남음')])
    const nested = normalizeDocument(doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 999 }, content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell('x')] }] }, p('ok')] }] }] }))
    const c = nested!.content![0].content![0].content![0]
    expect(c.attrs?.colspan).toBe(1)
    expect(JSON.stringify(c.content)).not.toContain('"table"')
  })
  it('round trips a checklist and coerces checked to a boolean', () => {
    const d = doc({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('완료')] }, { type: 'taskItem', attrs: { checked: false }, content: [p('대기')] }] })
    expect(roundTrip(d)?.content?.[0]).toEqual(d.content[0])
    const odd = normalizeDocument(doc({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: 'yes' }, content: [p('a')] }, p('stray')] }))
    expect(odd?.content?.[0].content).toEqual([{ type: 'taskItem', attrs: { checked: false }, content: [p('a')] }])
  })
  it('keeps the divider and serialises a doc of only new blocks as a block document', () => {
    const d = doc({ type: 'horizontalRule' }, { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p('a')] }] }] })
    expect(hasBlocks(d)).toBe(true)
    expect(tiptapContentToMarkdown(d as never).startsWith(NOTE_PREFIX)).toBe(true)
    expect(hasBlocks(doc({ type: 'taskList', content: [] }))).toBe(true)
  })
  it('validates card attrs and hides a card with no deck/plan chosen', () => {
    const ok = normalizeDocument(doc({ type: 'noteCard', attrs: { kind: 'plan', id: 'abc-123' } }))
    expect(ok?.content?.[0]).toEqual({ type: 'noteCard', attrs: { kind: 'plan', id: 'abc-123' } })
    expect(normalizeDocument(doc({ type: 'noteCard', attrs: { kind: 'user', id: 'a' } }))?.content).toEqual([{ type: 'paragraph' }])
    expect(normalizeDocument(doc({ type: 'noteCard', attrs: { kind: 'deck', id: '"><script>' } }))?.content?.[0].attrs?.id).toBe('')
    expect(visibleNode({ type: 'noteCard', attrs: { kind: 'deck', id: '' } })).toBe(false)
    expect(visibleNode({ type: 'noteCard', attrs: { kind: 'deck', id: 'x1' } })).toBe(true)
  })
  it('drops unknown nodes instead of throwing', () => {
    expect(normalizeDocument(doc({ type: 'noteFuture', content: [p('x')] }, p('keep')))?.content).toEqual([p('keep')])
  })
})

describe('REQ-COMMUNITY-038 links look like links', () => {
  const css = readFileSync('app/globals.css', 'utf8')
  it('styles links in the viewer and the editor with accent colour and underline', () => {
    expect(css).toMatch(/\.note-block-document a\[href\][^}]*text-decoration:\s*underline/)
    expect(css).toMatch(/\.note-document-content a[^}]*text-decoration:\s*underline/)
  })
})

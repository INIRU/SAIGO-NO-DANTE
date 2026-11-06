import { describe, expect, it } from 'vitest'
import { Node as TNode, getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { blockAtSelection, blocksAtSelection, duplicateBlockTr, moveBlockTr } from '@/features/notes/lib/block-ops'

const Asset = TNode.create({ name: 'noteAsset', group: 'block', atom: true, addAttributes: () => ({ id: { default: '' } }) })
const Upload = TNode.create({ name: 'noteUpload', group: 'block', atom: true, addAttributes: () => ({ id: { default: '' } }) })
const Callout = TNode.create({ name: 'noteCallout', group: 'block', content: 'block+' })
const schema = getSchema([StarterKit, Asset, Upload, Callout])
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const make = (...content: object[]) => EditorState.create({ schema, doc: schema.nodeFromJSON({ type: 'doc', content }) })
const texts = (state: EditorState) => state.doc.content.content.map(n => n.type.name === 'paragraph' ? n.textContent : n.type.name + (n.attrs.id ? ':' + n.attrs.id : ''))
const apply = (state: EditorState, tr: ReturnType<typeof moveBlockTr>) => state.apply(tr!)
const cursorIn = (state: EditorState, text: string, offset = 1) => {
  let found = -1
  state.doc.descendants((n, pos) => { if (n.isText && n.text === text) found = pos + offset })
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, found)))
}

describe('REQ-COMMUNITY-049 block duplicate and keyboard move', () => {
  it('REQ-COMMUNITY-049 finds the block the caret sits in, or the selected block', () => {
    const state = cursorIn(make(p('a'), p('b')), 'b')
    expect(blockAtSelection(state)?.node.textContent).toBe('b')
    const atom = make(p('a'), { type: 'noteAsset', attrs: { id: 'x' } })
    const selected = atom.apply(atom.tr.setSelection(NodeSelection.create(atom.doc, 3)))
    expect(blockAtSelection(selected)?.node.type.name).toBe('noteAsset')
  })
  it('REQ-COMMUNITY-049 lists the paragraph first, then the callout around it', () => {
    const state = cursorIn(make({ type: 'noteCallout', content: [p('in')] }, p('out')), 'in')
    expect(blocksAtSelection(state).map(b => b.node.type.name)).toEqual(['paragraph', 'noteCallout'])
  })
  it('REQ-COMMUNITY-049 moves the callout when its only paragraph has no sibling to swap with', () => {
    const state = cursorIn(make({ type: 'noteCallout', content: [p('in')] }, p('out')), 'in')
    const next = apply(state, moveBlockTr(state, 1))
    expect(next.doc.child(0).textContent).toBe('out')
    expect(next.selection.$from.parent.textContent).toBe('in')
  })
  it('REQ-COMMUNITY-049 duplicates the block right after itself and selects the copy', () => {
    const state = cursorIn(make(p('a'), p('b'), p('c')), 'b')
    const next = apply(state, duplicateBlockTr(state))
    expect(texts(next)).toEqual(['a', 'b', 'b', 'c'])
    expect(blockAtSelection(next)?.pos).toBeGreaterThan(blockAtSelection(state)!.pos)
  })
  it('REQ-COMMUNITY-049 duplicates an atom block and selects the copy', () => {
    const state = make({ type: 'noteAsset', attrs: { id: 'x' } }, p('a'))
    const selected = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, 0)))
    const next = apply(selected, duplicateBlockTr(selected))
    expect(texts(next)).toEqual(['noteAsset:x', 'noteAsset:x', 'a'])
    expect(next.selection instanceof NodeSelection && next.selection.from).toBe(1)
  })
  it('REQ-COMMUNITY-049 does not duplicate an upload placeholder', () => {
    const state = make({ type: 'noteUpload', attrs: { id: 'u' } }, p('a'))
    const selected = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, 0)))
    expect(duplicateBlockTr(selected)).toBeNull()
  })
  it('REQ-COMMUNITY-049 moves the block up or down and keeps the caret inside it', () => {
    const state = cursorIn(make(p('a'), p('bcd'), p('c')), 'bcd', 2)
    const down = apply(state, moveBlockTr(state, 1))
    expect(texts(down)).toEqual(['a', 'c', 'bcd'])
    expect(down.selection.$from.parent.textContent).toBe('bcd')
    expect(down.selection.$from.parentOffset).toBe(2)
    const up = apply(state, moveBlockTr(state, -1))
    expect(texts(up)).toEqual(['bcd', 'a', 'c'])
  })
  it('REQ-COMMUNITY-049 stays put at the ends', () => {
    const first = cursorIn(make(p('a'), p('b')), 'a')
    expect(moveBlockTr(first, -1)).toBeNull()
    const last = cursorIn(make(p('a'), p('b')), 'b')
    expect(moveBlockTr(last, 1)).toBeNull()
  })
})

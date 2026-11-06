import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'

/** Nodes whose children are the blocks a user thinks of as "a block" in a note. */
const BLOCK_HOSTS = new Set(['doc', 'noteBody', 'noteCallout'])
/** The upload placeholder carries an id the upload looks for: a copy would be filled in twice. */
const NOT_DUPLICATED = new Set(['noteUpload'])

export type BlockAt = { pos: number; node: PMNode }

/**
 * The blocks around the selection, innermost first: the selected block or the paragraph/list/table the caret sits in,
 * then the callout or accordion body holding it, and so on out to the top level.
 */
export function blocksAtSelection(state: EditorState): BlockAt[] {
  const { selection } = state
  const found: BlockAt[] = []
  if (selection instanceof NodeSelection && BLOCK_HOSTS.has(selection.$from.parent.type.name)) found.push({ pos: selection.from, node: selection.node })
  const $from = selection.$from
  for (let depth = $from.depth; depth >= 1; depth--) {
    if (BLOCK_HOSTS.has($from.node(depth - 1).type.name)) found.push({ pos: $from.before(depth), node: $from.node(depth) })
  }
  return found
}
export const blockAtSelection = (state: EditorState): BlockAt | null => blocksAtSelection(state)[0] ?? null

/** Puts the selection back into the block after it moved to `newPos`, at the same offsets. */
function keepSelection(state: EditorState, tr: Transaction, block: BlockAt, newPos: number) {
  const { selection } = state
  const end = block.pos + block.node.nodeSize
  if (selection.from < block.pos || selection.to > end) return
  tr.setSelection(selection instanceof NodeSelection
    ? NodeSelection.create(tr.doc, newPos)
    : TextSelection.create(tr.doc, newPos + selection.from - block.pos, newPos + selection.to - block.pos))
}

/** Swaps the block at `pos` with its previous (-1) or next (+1) sibling; null when there is none. */
export function moveBlockAtTr(state: EditorState, pos: number, direction: -1 | 1): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node) return null
  const $pos = state.doc.resolve(pos), target = $pos.index() + direction, parent = $pos.parent
  if (target < 0 || target >= parent.childCount) return null
  const sibling = parent.child(target)
  const tr = direction < 0
    ? state.tr.delete(pos, pos + node.nodeSize).insert(pos - sibling.nodeSize, node)
    : state.tr.insert(pos + node.nodeSize + sibling.nodeSize, node).delete(pos, pos + node.nodeSize)
  keepSelection(state, tr, { pos, node }, direction < 0 ? pos - sibling.nodeSize : pos + sibling.nodeSize)
  return tr.scrollIntoView()
}
/** Moves the innermost block that has a sibling on that side: the only paragraph of a callout moves the callout. */
export function moveBlockTr(state: EditorState, direction: -1 | 1): Transaction | null {
  for (const block of blocksAtSelection(state)) {
    const tr = moveBlockAtTr(state, block.pos, direction)
    if (tr) return tr
  }
  return null
}

/** Inserts a copy of the block at `pos` right after it and selects the copy. */
export function duplicateBlockAtTr(state: EditorState, pos: number): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node || NOT_DUPLICATED.has(node.type.name)) return null
  const copyPos = pos + node.nodeSize
  const tr = state.tr.insert(copyPos, node)
  tr.setSelection(node.isAtom ? NodeSelection.create(tr.doc, copyPos) : TextSelection.near(tr.doc.resolve(copyPos + 1)))
  return tr.scrollIntoView()
}
export function duplicateBlockTr(state: EditorState): Transaction | null {
  const block = blockAtSelection(state)
  return block ? duplicateBlockAtTr(state, block.pos) : null
}

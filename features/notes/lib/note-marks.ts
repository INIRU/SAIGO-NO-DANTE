import { Mark, mergeAttributes } from '@tiptap/core'
import { isNoteColorSin } from '@/lib/notes/text-style'

/**
 * Text marks of a note beyond bold and italic. The highlight is listed before the colour so it is the outer element
 * (the stylesheet lightens the colour inside it); the viewer draws them in the same nesting.
 */
const NoteHighlight = Mark.create({
  name: 'highlight',
  parseHTML() { return [{ tag: 'mark' }] },
  renderHTML({ HTMLAttributes }) { return ['mark', mergeAttributes(HTMLAttributes, { class: 'note-highlight' }), 0] },
})

const NoteColor = Mark.create({
  name: 'noteColor',
  addAttributes() {
    return {
      sin: {
        default: null,
        parseHTML: element => { const sin = element.getAttribute('data-note-color'); return isNoteColorSin(sin) ? sin : null },
        renderHTML: attributes => isNoteColorSin(attributes.sin) ? { 'data-note-color': attributes.sin, style: `--note-sin:var(--${attributes.sin})` } : {},
      },
    }
  },
  parseHTML() { return [{ tag: 'span[data-note-color]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes, { class: 'note-sin-color' }), 0] },
})

export const noteMarkExtensions = [NoteHighlight, NoteColor]

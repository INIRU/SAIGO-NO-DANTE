/**
 * The inline syntax of a plain/markdown memo, shared by the renderer (features/notes/components/NoteRenderer.tsx) and the note text helpers
 * (lib/notes/blocks.ts) so both read the same text the same way.
 * The functions return fresh global regular expressions (a shared one would keep its position between uses).
 */

const NESTED = '((?:[^\\[\\]]|\\[[^\\]]*\\])+?)\\s*'

/** `[s:…]` skill, `[p:…]` passive, `[e:…]` E.G.O, `[k:…]` keyword, `[i:…]` identity, `[g:…]` gift; the key is in the group of its letter. */
export function noteTokenPattern(): RegExp {
  return new RegExp(['s', 'p', 'e', 'k', 'i', 'g'].map(letter => `\\[${letter}:${NESTED}\\]`).join('|'), 'g')
}

/** Markdown inside a text: `[text](https://…)` (groups 2, 3), `**bold**`, `*italic*`, `_italic_`, `` `code` ``. */
export function noteInlineMarkdownPattern(): RegExp {
  return /(\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`)/g
}

/** `{{skill:…}}`, `{{passive:…}}`, `{{gift:…}}`: a card drawn in place of the token, on its own line. */
export function noteBlockTokenPattern(): RegExp {
  return /\{\{skill:[^{}\n]+:\d+(?::\d+)?\}\}|\{\{passive:[^{}\n]+\}\}|\{\{gift:[^{}\n:]+(?::true)?\}\}/g
}

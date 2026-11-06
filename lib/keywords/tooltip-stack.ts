/** Keyword tooltips draw over preview cards (.note-preview-popover, 10050) and dialogs; a nested one is a later portal, so it lands on top. */
export const KEYWORD_TOOLTIP_Z = 10100

/** An open keyword tooltip: how many tooltips it sits inside (0 on the page) and how to close it. */
export type TipEntry = { depth: number; close: () => void }

/** Opening `entry` closes the open tooltips at its depth or deeper (a sibling and what it opened); the outer ones stay. */
export function openTip(stack: readonly TipEntry[], entry: TipEntry): TipEntry[] {
  const keep: TipEntry[] = []
  for (const open of stack) {
    if (open === entry) continue
    if (open.depth >= entry.depth) open.close()
    else keep.push(open)
  }
  return [...keep, entry]
}

export const closeTip = (stack: readonly TipEntry[], entry: TipEntry) => stack.filter(open => open !== entry)

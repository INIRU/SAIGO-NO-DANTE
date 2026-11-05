type Box = { left: number; top: number; right: number; bottom: number }

export type PopoverPlacement = {
  left: number
  /** The edge next to the name: the card's top when it sits below, its bottom when it sits above. */
  top: number
  above: boolean
  width: number
  /** Set when the card is still too tall at the widest width: it is cut to the free side and its body scrolls. */
  maxHeight: number | undefined
}

/**
 * Where a hover card goes and how wide it is. Tries `widths` narrowest first and takes the first whose height (`measureHeight`,
 * read from the real card) fits the roomier side of the name and stays within `maxHeightRatio` of the screen. The card goes
 * below the name while it fits there, otherwise on the roomier side. Nothing fitting takes the widest width, cut to that side.
 * Every width is capped to the screen minus the gutters; the card stays inside the screen sideways.
 */
export function placePopover({ anchor, view, widths, measureHeight, gap = 8, margin = 8, align = 'start', maxHeightRatio = 0.6 }: {
  anchor: Box
  view: { width: number; height: number }
  widths: readonly number[]
  measureHeight: (width: number) => number
  gap?: number
  margin?: number
  /** `start`: the card's left edge at the name's; `center`: centred on it. */
  align?: 'start' | 'center'
  maxHeightRatio?: number
}): PopoverPlacement {
  const below = view.height - anchor.bottom - gap - margin
  const above = anchor.top - gap - margin
  const roomy = Math.max(below, above)
  const limit = view.height * maxHeightRatio
  const capped = [...new Set(widths.map(width => Math.max(0, Math.min(width, view.width - 2 * margin))))].sort((a, b) => a - b)
  let width = capped[capped.length - 1], height = 0, fits = false
  for (const candidate of capped) {
    width = candidate
    height = measureHeight(candidate)
    fits = height <= roomy && height <= limit
    if (fits) break
  }
  const goAbove = height > below && above > below
  const wanted = align === 'center' ? (anchor.left + anchor.right) / 2 - width / 2 : anchor.left
  const cap = Math.max(0, Math.min(roomy, limit))
  return {
    left: Math.max(margin, Math.min(wanted, view.width - margin - width)),
    top: goAbove ? anchor.top - gap : anchor.bottom + gap,
    above: goAbove,
    width,
    maxHeight: fits || height <= cap ? undefined : cap,
  }
}

/**
 * placePopover for a card that is already in the page (hidden): sets each candidate width on it, reads its real height with
 * the scroll cap lifted, then puts its styles back. `fit: 'shrink'` sets the width as a max-width so a short card keeps its own width.
 */
export function placePopoverIn(card: HTMLElement, scroller: HTMLElement, options: Omit<Parameters<typeof placePopover>[0], 'measureHeight'> & { fit?: 'fixed' | 'shrink' }): PopoverPlacement {
  const property = options.fit === 'shrink' ? 'maxWidth' : 'width'
  const kept = { size: card.style[property], cap: scroller.style.maxHeight }
  scroller.style.maxHeight = 'none'
  try {
    return placePopover({ ...options, measureHeight: width => { card.style[property] = `${width}px`; return card.getBoundingClientRect().height } })
  } finally {
    card.style[property] = kept.size
    scroller.style.maxHeight = kept.cap
  }
}
